"""Import Gmail activity only for the authenticated profile that owns it."""

import asyncio
import logging
import json
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from src.db.models import GoogleUserSession
from src.db.session import AsyncSessionLocal
from src.services.google_auth_service import GoogleAuthService
from src.services.idempotency import idempotency_service

logger = logging.getLogger(__name__)


class GmailRealtimePoller:
    def __init__(self):
        self.task = None
        self.manual_tasks = set()

    async def start(self):
        self.task = asyncio.create_task(self.run())

    async def stop(self):
        for task in self.manual_tasks:
            task.cancel()
        if self.manual_tasks:
            await asyncio.gather(*self.manual_tasks, return_exceptions=True)
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass

    async def status(self, user_id):
        redis = await idempotency_service.get_client()
        if await redis.get(f"gmail:sync:{user_id}"):
            return {"status": "syncing"}
        saved = await redis.get(f"gmail:sync-result:{user_id}")
        return json.loads(saved) if saved else {"status": "idle"}

    async def request_sync(self, user_id):
        async def run():
            try:
                await self.sync_user_now(user_id)
            except Exception:
                logger.warning("Requested Gmail sync failed for profile %s", user_id)

        task = asyncio.create_task(run())
        self.manual_tasks.add(task)
        task.add_done_callback(self.manual_tasks.discard)
        return {"status": "started"}

    async def sync_user_now(self, user_id):
        redis = await idempotency_service.get_client()
        key, lock = f"gmail:sync:{user_id}", secrets.token_urlsafe(24)
        if not await redis.set(key, lock, nx=True, ex=150):
            return {"status": "already_syncing", "synced": 0}
        try:
            async with AsyncSessionLocal() as db:
                user = (
                    await db.execute(
                        select(GoogleUserSession).where(
                            GoogleUserSession.id == user_id,
                            GoogleUserSession.session_expires_at
                            > datetime.now(timezone.utc),
                        )
                    )
                ).scalar_one_or_none()
                if not user:
                    raise ValueError("Session expired")
                if not user.token_expires_at or user.token_expires_at <= datetime.now(
                    timezone.utc
                ) + timedelta(minutes=5):
                    if not user.refresh_token:
                        raise ValueError("Reconnect Google")
                    tokens = await GoogleAuthService.refresh_access_token(
                        user.refresh_token
                    )
                    user.access_token = tokens["access_token"]
                    user.token_expires_at = datetime.now(timezone.utc) + timedelta(
                        seconds=int(tokens.get("expires_in", 3600))
                    )
                    await db.commit()
                result = await asyncio.wait_for(
                    GoogleAuthService.sync_gmail_transactions(
                        user.access_token, user_id=user.id, max_results=30
                    ),
                    timeout=120,
                )
                user.last_synced_at = datetime.now(timezone.utc)
                await db.commit()
                await redis.set(
                    f"gmail:sync-result:{user_id}",
                    json.dumps(result, default=str),
                    ex=86400,
                )
                return result
        except Exception:
            await redis.set(
                f"gmail:sync-result:{user_id}",
                json.dumps(
                    {
                        "status": "error",
                        "message": "Gmail sync could not finish. Please try again.",
                    }
                ),
                ex=86400,
            )
            raise
        finally:
            await redis.eval(
                "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
                1,
                key,
                lock,
            )

    async def run(self):
        await asyncio.sleep(5)
        while True:
            try:
                async with AsyncSessionLocal() as db:
                    ids = (
                        (
                            await db.execute(
                                select(GoogleUserSession.id).where(
                                    GoogleUserSession.session_expires_at
                                    > datetime.now(timezone.utc),
                                    GoogleUserSession.google_subject.is_not(None),
                                )
                            )
                        )
                        .scalars()
                        .all()
                    )
                for user_id in ids:
                    try:
                        # Coordinate the polling interval across API processes.
                        redis = await idempotency_service.get_client()
                        if not await redis.set(
                            f"gmail:poll:{user_id}", "1", nx=True, ex=60
                        ):
                            continue
                        await self.sync_user_now(user_id)
                    except Exception:
                        logger.warning(
                            "Background Gmail sync failed for profile %s", user_id
                        )
            except Exception:
                logger.warning("Gmail sync is temporarily unavailable")
            await asyncio.sleep(60)


gmail_realtime_poller = GmailRealtimePoller()
