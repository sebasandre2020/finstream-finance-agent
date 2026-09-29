"""Cookie sessions shared by API endpoints. Credentials never enter frontend storage."""

import hashlib
from datetime import datetime, timezone
from urllib.parse import urlsplit

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.db.models import GoogleUserSession
from src.db.session import get_db

SESSION_COOKIE = "finstream_session"


def token_digest(token: str) -> str:
    return "sha256:" + hashlib.sha256(token.encode()).hexdigest()


async def require_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> GoogleUserSession:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(401, "Sign in with Google to view your finances.")
    user = (
        await db.execute(
            select(GoogleUserSession).where(
                GoogleUserSession.session_token == token_digest(token),
                GoogleUserSession.session_expires_at > datetime.now(timezone.utc),
            )
        )
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(401, "Your session expired. Please sign in again.")
    return user


def require_same_origin(request: Request) -> None:
    expected = urlsplit(settings.FRONTEND_URL)
    origin = f"{expected.scheme}://{expected.netloc}"
    if request.headers.get("origin") != origin:
        raise HTTPException(403, "Invalid request origin.")
