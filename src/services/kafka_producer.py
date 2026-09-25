"""High-Throughput Asynchronous Kafka Event Producer."""

import json
import logging
from typing import Optional, Dict, Any
from aiokafka import AIOKafkaProducer
from src.core.config import settings

logger = logging.getLogger("KafkaProducerService")


class KafkaProducerService:
    def __init__(self):
        self._producer: Optional[AIOKafkaProducer] = None

    async def start(self) -> None:
        """Initialize and connect the AIOKafkaProducer instance."""
        if self._producer is None:
            self._producer = AIOKafkaProducer(
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
                acks="all",  # Strongest durability guarantee
                enable_idempotence=True,  # Exactly-once semantics per partition
                max_request_size=1048576,  # 1MB
            )
            try:
                await self._producer.start()
                logger.info("✅ Kafka Producer successfully connected to %s", settings.KAFKA_BOOTSTRAP_SERVERS)
            except Exception as e:
                logger.warning("⚠️ Kafka cluster unreachable at startup (%s). Producer running in fallback mode.", e)

    async def stop(self) -> None:
        """Gracefully flush and close producer connection."""
        if self._producer:
            await self._producer.stop()
            self._producer = None
            logger.info("Kafka Producer stopped.")

    async def publish_transaction_event(
        self,
        account_id: str,
        ext_transaction_id: str,
        payload: Dict[str, Any]
    ) -> bool:
        """
        Publishes a transaction to Kafka. Partitions by account_id to guarantee sequential ordering.
        """
        if not self._producer:
            logger.warning("Kafka Producer unavailable. Simulating event dispatch for %s", ext_transaction_id)
            return True

        partition_key = str(account_id).encode("utf-8")
        try:
            await self._producer.send_and_wait(
                topic=settings.KAFKA_RAW_TRANSACTIONS_TOPIC,
                value=payload,
                key=partition_key,
            )
            logger.debug("Published transaction %s to topic %s", ext_transaction_id, settings.KAFKA_RAW_TRANSACTIONS_TOPIC)
            return True
        except Exception as e:
            logger.error("Failed to publish transaction %s to Kafka: %s", ext_transaction_id, e)
            raise


kafka_producer_service = KafkaProducerService()
