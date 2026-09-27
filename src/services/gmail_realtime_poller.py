"""Continuous Background Poller for Real-Time Gmail Banking Transactions."""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from src.db.models import GoogleUserSession
from src.db.session import AsyncSessionLocal
from src.services.google_auth_service import GoogleAuthService
from src.services.sse_broadcaster import sse_broadcaster

logger = logging.getLogger("GmailRealtimePoller")

POLL_INTERVAL_SECONDS = 60


class GmailRealtimePoller:
    """Continuously monitors Gmail for connected users and ingests real-time bank notifications."""

    def __init__(self, interval_seconds: int = POLL_INTERVAL_SECONDS):
        self.interval = interval_seconds
        self._task: asyncio.Task | None = None
        self._is_running = False

    async def start(self) -> None:
        """Starts the background polling loop."""
        if self._is_running:
            return
        self._is_running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info(
            "🚀 Gmail Realtime Poller started (polling interval: %ds).",
            self.interval,
        )

    async def stop(self) -> None:
        """Stops the background polling loop gracefully."""
        self._is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
            logger.info("🛑 Gmail Realtime Poller stopped.")

    async def sync_user_now(self, session_token: str) -> dict:
        """Immediately triggers a sync for a specific user session token."""
        async with AsyncSessionLocal() as db:
            now = datetime.now(UTC)
            res = await db.execute(
                select(GoogleUserSession).where(
                    GoogleUserSession.session_token == session_token,
                    GoogleUserSession.session_expires_at > now,
                )
            )
            user_session = res.scalar_one_or_none()
            if not user_session:
                return {"status": "error", "error": "Invalid or expired session"}

            access_token = await self._ensure_valid_token(user_session, db)
            sync_res = await GoogleAuthService.sync_gmail_transactions(
                access_token=access_token,
                max_results=30,
            )
            user_session.last_synced_at = datetime.now(UTC)
            await db.commit()
            return sync_res

    async def _ensure_valid_token(self, user_session: GoogleUserSession, db) -> str:
        """Refreshes Google access token using refresh_token if expired or near expiry."""
        now = datetime.now(UTC)
        if (
            user_session.token_expires_at
            and user_session.token_expires_at > now + timedelta(minutes=5)
        ):
            return user_session.access_token

        if not user_session.refresh_token:
            return user_session.access_token

        try:
            logger.info(
                "Refreshing expired Google access token for %s",
                user_session.email,
            )
            refreshed = await GoogleAuthService.refresh_access_token(
                user_session.refresh_token
            )
            new_access_token = refreshed["access_token"]
            expires_in = refreshed.get("expires_in", 3600)
            user_session.access_token = new_access_token
            user_session.token_expires_at = now + timedelta(seconds=expires_in)
            await db.commit()
            return new_access_token
        except Exception as e:
            logger.warning(
                "Failed to refresh Google token for %s: %s",
                user_session.email,
                e,
            )
            return user_session.access_token

    async def _poll_loop(self) -> None:
        """Main polling cycle."""
        # Initial wait so services can settle at startup
        await asyncio.sleep(5)

        while self._is_running:
            try:
                now = datetime.now(UTC)
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(GoogleUserSession).where(
                            GoogleUserSession.session_expires_at > now
                        )
                    )
                    active_sessions = result.scalars().all()

                    for user_session in active_sessions:
                        try:
                            token = await self._ensure_valid_token(user_session, db)
                            sync_result = (
                                await GoogleAuthService.sync_gmail_transactions(
                                    access_token=token,
                                    max_results=15,
                                )
                            )
                            user_session.last_synced_at = datetime.now(UTC)
                            await db.commit()

                            synced_count = sync_result.get("synced", 0)
                            if synced_count > 0:
                                logger.info(
                                    "✨ Poller ingested %d new transactions for %s",
                                    synced_count,
                                    user_session.email,
                                )
                                await sse_broadcaster.broadcast(
                                    "gmail_sync_complete",
                                    {
                                        "email": user_session.email,
                                        "synced": synced_count,
                                        "synced_at": datetime.now(UTC).isoformat(),
                                    },
                                )
                        except Exception as user_err:
                            logger.error(
                                "Error during background Gmail sync for %s: %s",
                                user_session.email,
                                user_err,
                            )

            except asyncio.CancelledError:
                break
            except Exception as loop_err:
                logger.error(
                    "Unexpected error in Gmail realtime poller loop: %s",
                    loop_err,
                )

            try:
                await asyncio.sleep(self.interval)
            except asyncio.CancelledError:
                break


gmail_realtime_poller = GmailRealtimePoller()
