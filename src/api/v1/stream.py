"""Server-Sent Events (SSE) Live Feed Endpoint for React Dashboard."""

import asyncio
import json
import logging
from typing import AsyncGenerator
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from src.services.sse_broadcaster import sse_broadcaster

logger = logging.getLogger("SSEStreamEndpoint")
router = APIRouter(prefix="/stream", tags=["Streaming & SSE"])


async def event_generator(request: Request) -> AsyncGenerator[str, None]:
    """Yields real-time events to connected clients with 15-second heartbeats."""
    queue = sse_broadcaster.subscribe()
    try:
        # Initial greeting event
        yield "event: connected\ndata: {\"status\": \"ready\"}\n\n"

        while True:
            # Client disconnected check
            if await request.is_disconnected():
                break

            try:
                # Wait for next event or trigger heartbeat after 15 seconds
                msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                event_name = msg.get("event", "message")
                payload = json.dumps(msg.get("data", {}), default=str)
                yield f"event: {event_name}\ndata: {payload}\n\n"
            except asyncio.TimeoutError:
                # Heartbeat comment to keep connection alive through ALBs and proxies
                yield ": ping\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        sse_broadcaster.unsubscribe(queue)


@router.get(
    "/events",
    response_class=StreamingResponse,
    summary="Subscribe to live SSE stream",
    description="Maintains persistent HTTP streaming connection pushing transaction updates and anomaly alerts."
)
async def live_stream(request: Request):
    return StreamingResponse(
        event_generator(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disables proxy buffering in Nginx/ALBs
        }
    )
