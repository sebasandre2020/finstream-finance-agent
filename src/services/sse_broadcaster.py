"""Server-Sent Events (SSE) Broadcaster with Redis Pub/Sub for Distributed Real-Time Updates."""

import asyncio
import json
import logging
from typing import Set, Dict, Any, Optional
import redis.asyncio as aioredis
from src.core.config import settings

logger = logging.getLogger("SSEBroadcaster")

REDIS_CHANNEL = "finance:sse_events"


class SSEBroadcaster:
    """Manages active streaming connections to browser dashboards and bridges cross-container events via Redis Pub/Sub."""
    def __init__(self):
        self._subscribers: Set[asyncio.Queue] = set()
        self._redis: Optional[aioredis.Redis] = None
        self._listener_task: Optional[asyncio.Task] = None

    async def get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=5.0
            )
        return self._redis

    async def start_listener(self):
        """Starts background listener task for Redis pub/sub if not already running."""
        if self._listener_task is None or self._listener_task.done():
            self._listener_task = asyncio.create_task(self._redis_pubsub_listener())

    async def stop_listener(self):
        """Stops the Redis pub/sub listener task."""
        if self._listener_task and not self._listener_task.done():
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
        if self._redis:
            await self._redis.aclose()
            self._redis = None

    async def _redis_pubsub_listener(self):
        """Listens for messages on Redis channel and forwards to local in-memory queues."""
        while True:
            try:
                client = await self.get_redis()
                pubsub = client.pubsub()
                await pubsub.subscribe(REDIS_CHANNEL)
                logger.info("Connected to Redis Pub/Sub channel '%s'", REDIS_CHANNEL)

                async for message in pubsub.listen():
                    if message["type"] == "message":
                        try:
                            payload = json.loads(message["data"])
                            self._dispatch_local(payload)
                        except Exception as e:
                            logger.error("Error dispatching pubsub message: %s", e)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning("Redis Pub/Sub listener error: %s. Reconnecting in 3s...", e)
                await asyncio.sleep(3.0)

    def _dispatch_local(self, message: Dict[str, Any]):
        dead_queues = set()
        for q in self._subscribers:
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                logger.warning("Subscriber queue overflow. Discarding slow consumer.")
                dead_queues.add(q)
            except Exception as e:
                logger.error("Error broadcasting to subscriber: %s", e)
                dead_queues.add(q)

        for q in dead_queues:
            self._subscribers.discard(q)

    def subscribe(self) -> asyncio.Queue:
        """Registers a new active client event queue."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers.add(queue)
        try:
            loop = asyncio.get_running_loop()
            if self._listener_task is None or self._listener_task.done():
                self._listener_task = loop.create_task(self._redis_pubsub_listener())
        except RuntimeError:
            pass
        logger.info("New SSE client subscribed. Total active listeners: %d", len(self._subscribers))
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        """Removes a client queue on disconnect."""
        self._subscribers.discard(queue)
        logger.info("SSE client disconnected. Remaining listeners: %d", len(self._subscribers))

    async def broadcast(self, event_type: str, data: Dict[str, Any]) -> None:
        """Dispatches an event payload to local subscribers and publishes via Redis Pub/Sub."""
        message = {
            "event": event_type,
            "data": data
        }
        # Publish via Redis so other containers (FastAPI API server) receive it
        try:
            client = await self.get_redis()
            await client.publish(REDIS_CHANNEL, json.dumps(message, default=str))
        except Exception as e:
            logger.warning("Failed to publish SSE event to Redis (%s). Dispatching locally only.", e)
            self._dispatch_local(message)


sse_broadcaster = SSEBroadcaster()
