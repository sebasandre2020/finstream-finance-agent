"""Decoupled Kafka Consumer Worker for Agentic Transaction Processing."""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.db.session import AsyncSessionLocal
from src.db.models import Transaction, Account
from src.ai.graph import transaction_agent_graph
from src.services.sse_broadcaster import sse_broadcaster

logging.basicConfig(
    level=settings.LOG_LEVEL.upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("KafkaAgentWorker")


class KafkaAgentWorker:
    def __init__(self):
        self.consumer: AIOKafkaConsumer = None
        self.dlq_producer: AIOKafkaProducer = None
        self.is_running: bool = False

    async def start(self):
        """Initializes Kafka consumer group and DLQ producer."""
        logger.info("Initializing Kafka Consumer Worker on topic: %s", settings.KAFKA_RAW_TRANSACTIONS_TOPIC)
        
        self.consumer = AIOKafkaConsumer(
            settings.KAFKA_RAW_TRANSACTIONS_TOPIC,
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id=settings.KAFKA_CONSUMER_GROUP,
            enable_auto_commit=False,  # Strict manual offset commits after DB transaction
            auto_offset_reset="earliest",
            max_poll_records=50,
            value_deserializer=lambda m: json.loads(m.decode("utf-8"))
        )

        self.dlq_producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8")
        )

        await self.consumer.start()
        await self.dlq_producer.start()
        self.is_running = True
        logger.info("✅ Consumer Group '%s' active and listening.", settings.KAFKA_CONSUMER_GROUP)

    async def stop(self):
        self.is_running = False
        if self.consumer:
            await self.consumer.stop()
        if self.dlq_producer:
            await self.dlq_producer.stop()
        logger.info("Consumer worker stopped.")

    async def process_record(self, raw_envelope: Dict[str, Any], session: AsyncSession):
        payload = raw_envelope.get("payload", {})
        account_id_str = payload["account_id"]
        ext_tx_id = payload["ext_transaction_id"]
        amount = Decimal(str(payload["amount"]))
        raw_description = payload["raw_description"]
        tx_time_str = payload["transaction_time"]
        tx_time = datetime.fromisoformat(tx_time_str.replace("Z", "+00:00"))

        # Verify Account exists or create default
        acct_uuid = uuid.UUID(account_id_str)
        acct_res = await session.execute(select(Account).where(Account.id == acct_uuid))
        account = acct_res.scalar_one_or_none()
        if not account:
            account = Account(
                id=acct_uuid,
                user_id=uuid.uuid4(),
                institution_name="Primary Connected Account",
                account_number_mask="*0000",
                currency="USD"
            )
            session.add(account)
            await session.flush()

        # 1. Run LangGraph reflection & entity classification
        agent_state = await transaction_agent_graph.run(
            session=session,
            account_id=account_id_str,
            ext_transaction_id=ext_tx_id,
            amount=amount,
            raw_description=raw_description
        )

        # 2. Persist classified transaction
        transaction = Transaction(
            id=uuid.uuid4(),
            account_id=acct_uuid,
            ext_transaction_id=ext_tx_id,
            amount=amount,
            raw_description=raw_description,
            normalized_merchant=agent_state.get("candidate_merchant"),
            category=agent_state.get("category", "Uncategorized"),
            sub_category=agent_state.get("subcategory"),
            confidence_score=agent_state.get("confidence_score", 0.9),
            is_anomaly=agent_state.get("is_anomaly", False),
            anomaly_reason=agent_state.get("anomaly_reason"),
            transaction_time=tx_time,
            processed_at=datetime.now(timezone.utc)
        )
        session.add(transaction)
        await session.commit()

        # 3. Broadcast real-time SSE updates
        event_data = {
            "id": str(transaction.id),
            "account_id": str(transaction.account_id),
            "institution_name": account.institution_name,
            "ext_transaction_id": transaction.ext_transaction_id,
            "amount": float(transaction.amount),
            "normalized_merchant": transaction.normalized_merchant,
            "category": transaction.category,
            "sub_category": transaction.sub_category,
            "confidence_score": transaction.confidence_score,
            "is_anomaly": transaction.is_anomaly,
            "anomaly_reason": transaction.anomaly_reason,
            "transaction_time": transaction.transaction_time.isoformat(),
            "processed_at": transaction.processed_at.isoformat()
        }
        await sse_broadcaster.broadcast("transaction_processed", event_data)

        if transaction.is_anomaly:
            await sse_broadcaster.broadcast("anomaly_detected", {
                "transaction_id": str(transaction.id),
                "merchant": transaction.normalized_merchant,
                "amount": float(transaction.amount),
                "category": transaction.category,
                "reason": transaction.anomaly_reason,
                "severity": "HIGH"
            })

    async def run(self):
        await self.start()
        try:
            while self.is_running:
                data = await self.consumer.getmany(timeout_ms=1000, max_records=20)
                for tp, messages in data.items():
                    for msg in messages:
                        retries = 0
                        max_retries = 3
                        success = False
                        
                        while retries < max_retries and not success:
                            async with AsyncSessionLocal() as session:
                                try:
                                    await self.process_record(msg.value, session)
                                    success = True
                                    # Commit Kafka offset only after successful processing
                                    await self.consumer.commit({tp: msg.offset + 1})
                                except Exception as e:
                                    retries += 1
                                    logger.error(
                                        "Error processing record (attempt %d/%d): %s",
                                        retries, max_retries, e
                                    )
                                    await asyncio.sleep(2 ** retries)

                        if not success:
                            logger.critical("Poison pill detected. Routing offset %d to DLQ.", msg.offset)
                            dlq_payload = {
                                "original": msg.value,
                                "failed_at": datetime.now(timezone.utc).isoformat(),
                                "topic": msg.topic,
                                "partition": msg.partition,
                                "offset": msg.offset
                            }
                            await self.dlq_producer.send_and_wait(
                                settings.KAFKA_DLQ_TOPIC,
                                dlq_payload
                            )
                            await self.consumer.commit({tp: msg.offset + 1})
        finally:
            await self.stop()


async def main():
    worker = KafkaAgentWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
