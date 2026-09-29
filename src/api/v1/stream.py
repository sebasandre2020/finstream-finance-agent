"""Authenticated event stream; never forwards events belonging to another profile."""

import asyncio
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from src.api.session import require_user
from src.db.models import Account, GoogleUserSession, Transaction
from src.db.session import AsyncSessionLocal
from src.services.sse_broadcaster import sse_broadcaster

router = APIRouter(prefix="/stream", tags=["Streaming & SSE"])


async def event_generator(request, user):
    queue = sse_broadcaster.subscribe()
    try:
        yield 'event: connected\ndata: {"status":"ready"}\n\n'
        while not await request.is_disconnected():
            # Recheck revocation while connected, including another tab signing out.
            async with AsyncSessionLocal() as db:
                active = await db.scalar(
                    select(GoogleUserSession.id).where(
                        GoogleUserSession.id == user.id,
                        GoogleUserSession.session_token == user.session_token,
                        GoogleUserSession.session_expires_at
                        > datetime.now(timezone.utc),
                    )
                )
                if not active:
                    break
            try:
                message = await asyncio.wait_for(queue.get(), timeout=15)
            except asyncio.TimeoutError:
                yield ": ping\n\n"
                continue
            if message.get("event") not in (
                "transaction_processed",
                "anomaly_detected",
            ):
                continue
            data = message.get("data", {})
            try:
                transaction_id = uuid.UUID(
                    data.get("id") or data.get("transaction_id", "")
                )
            except (ValueError, TypeError):
                continue
            async with AsyncSessionLocal() as db:
                owned = await db.scalar(
                    select(Transaction.id)
                    .join(Account)
                    .where(Transaction.id == transaction_id, Account.user_id == user.id)
                )
            if owned:
                yield f"event: {message['event']}\ndata: {json.dumps(data, default=str)}\n\n"
    finally:
        sse_broadcaster.unsubscribe(queue)


@router.get("/events")
async def live_stream(
    request: Request, user: GoogleUserSession = Depends(require_user)
):
    return StreamingResponse(
        event_generator(request, user),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
