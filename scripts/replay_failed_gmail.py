"""Replay failed Gmail imports for verified owners; dry-run unless --apply.
Does not delete DLQ records, change consumer offsets, or reassign accounts.
"""

import argparse
import asyncio
import json
import uuid

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer, TopicPartition
from sqlalchemy import select

from src.core.config import settings
from src.db.models import Account, GoogleUserSession, Transaction
from src.db.session import AsyncSessionLocal


async def replay(apply=False):
    async with AsyncSessionLocal() as db:
        owned = {
            str(x)
            for x in (
                await db.scalars(
                    select(Account.id)
                    .join(GoogleUserSession, GoogleUserSession.id == Account.user_id)
                    .where(GoogleUserSession.google_subject.is_not(None))
                )
            ).all()
        }
        existing = {
            (str(a), e)
            for a, e in (
                await db.execute(
                    select(
                        Transaction.account_id, Transaction.ext_transaction_id
                    ).where(
                        Account.id == Transaction.account_id,
                        Account.id.in_([uuid.UUID(x) for x in owned]),
                    )
                )
            ).all()
        }
    consumer = AIOKafkaConsumer(
        settings.KAFKA_DLQ_TOPIC,
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        enable_auto_commit=False,
        group_id=None,
        value_deserializer=lambda x: json.loads(x),
    )
    found = {}
    await consumer.start()
    try:
        parts = [
            TopicPartition(settings.KAFKA_DLQ_TOPIC, p)
            for p in consumer.partitions_for_topic(settings.KAFKA_DLQ_TOPIC)
        ]
        consumer.unsubscribe()
        consumer.assign(parts)
        ends = await consumer.end_offsets(parts)
        await consumer.seek_to_beginning(*parts)
        while True:
            if all([await consumer.position(p) >= ends[p] for p in parts]):
                break
            batches = await consumer.getmany(timeout_ms=2000, max_records=500)
            for part, messages in batches.items():
                for msg in messages:
                    if msg.offset >= ends[part]:
                        continue
                    event = msg.value.get("original", {})
                    payload = event.get("payload", {})
                    key = (payload.get("account_id"), payload.get("ext_transaction_id"))
                    if (
                        key[0] in owned
                        and key not in existing
                        and payload.get("source") == "gmail_oauth_sync"
                    ):
                        found[key] = event
        if apply:
            producer = AIOKafkaProducer(
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda x: json.dumps(x).encode(),
                enable_idempotence=True,
            )
            await producer.start()
            try:
                for (account, _), event in found.items():
                    await producer.send_and_wait(
                        settings.KAFKA_RAW_TRANSACTIONS_TOPIC,
                        value=event,
                        key=account.encode(),
                    )
            finally:
                await producer.stop()
        print(
            json.dumps(
                {
                    "eligible_failed_imports": len(found),
                    "replayed": len(found) if apply else 0,
                }
            )
        )
    finally:
        await consumer.stop()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    asyncio.run(replay(parser.parse_args().apply))
