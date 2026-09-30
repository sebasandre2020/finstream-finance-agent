"""Redis-Backed Distributed Idempotency and Deduplication Service."""

import hashlib
import logging

import redis.asyncio as aioredis

from src.core.config import settings

logger = logging.getLogger("IdempotencyService")


class IdempotencyService:
    def __init__(self):
        self._redis: aioredis.Redis | None = None

    async def get_client(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                settings.REDIS_URL, decode_responses=True, socket_timeout=2.0
            )
        return self._redis

    @staticmethod
    def generate_key(account_id: str, ext_transaction_id: str) -> str:
        """Derives a deterministic SHA256 key from account and external transaction ID."""
        raw_key = f"{account_id}:{ext_transaction_id}"
        hash_digest = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
        return f"idempotency:tx:{hash_digest}"

    async def check_and_set(self, account_id: str, ext_transaction_id: str) -> bool:
        """
        Attempts to acquire an atomic idempotency lock.
        Returns:
            True if this is the first time the transaction has been observed (lock acquired).
            False if the transaction is a duplicate within the TTL window.
        """
        key = self.generate_key(account_id, ext_transaction_id)
        try:
            client = await self.get_client()
            # SET key "1" NX EX ttl -> Returns True only if key was set (did not exist)
            is_new = await client.set(
                key, "1", nx=True, ex=settings.IDEMPOTENCY_TTL_SECONDS
            )
            return bool(is_new)
        except Exception as e:
            logger.warning(
                "Redis idempotency check failed (%s). Defaulting to pass-through.", e
            )
            return True

    async def is_message_processed(self, user_id: object, msg_id: str) -> bool:
        """Checks if a Gmail message ID has already been parsed or evaluated."""
        try:
            client = await self.get_client()
            val = await client.get(f"gmail:msg:{user_id}:{msg_id}")
            return bool(val)
        except Exception as e:
            logger.debug("Redis message check skipped (%s)", e)
            return False

    async def mark_message_processed(
        self, user_id: object, msg_id: str, ttl: int = 60 * 86400
    ) -> None:
        """Marks a Gmail message ID as processed with a TTL."""
        try:
            client = await self.get_client()
            await client.set(f"gmail:msg:{user_id}:{msg_id}", "1", ex=ttl)
        except Exception as e:
            logger.debug("Redis mark message failed (%s)", e)


idempotency_service = IdempotencyService()

