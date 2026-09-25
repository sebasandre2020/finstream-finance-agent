"""Server-Sent Events (SSE) In-Memory & Pub/Sub Broadcaster."""

import asyncio
import json
import logging
from typing import Set, Dict, Any

logger = logging.getLogger("SSEBroadcaster")


class SSEBroadcaster:
    """Manages active streaming connections to browser dashboards."""
    def __init__(self):
        self._subscribers: Set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        """Registers a new active client event queue."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers.add(queue)
        logger.info("New SSE client subscribed. Total active listeners: %d", len(self._subscribers))
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        """Removes a client queue on disconnect."""
        self._subscribers.discard(queue)
        logger.info("SSE client disconnected. Remaining listeners: %d", len(self._subscribers))

    async def broadcast(self, event_type: str, data: Dict[str, Any]) -> None:
        """Dispatches an event payload to all active client streams."""
        message = {
            "event": event_type,
            "data": data
        }
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


sse_broadcaster = SSEBroadcaster()
