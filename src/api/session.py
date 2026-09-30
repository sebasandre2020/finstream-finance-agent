"""Cookie sessions shared by API endpoints. Credentials never enter frontend storage."""

import hashlib
from datetime import UTC, datetime
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
                GoogleUserSession.session_expires_at > datetime.now(UTC),
            )
        )
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(401, "Your session expired. Please sign in again.")
    return user


def require_same_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if not origin:
        referer = request.headers.get("referer")
        if referer:
            ref_split = urlsplit(referer)
            origin = f"{ref_split.scheme}://{ref_split.netloc}"

    if not origin:
        raise HTTPException(403, "Invalid request origin.")

    origin_split = urlsplit(origin)
    origin_netloc = origin_split.netloc.lower()

    # 1. Allowed if origin netloc matches the configured FRONTEND_URL
    expected = urlsplit(settings.FRONTEND_URL)
    if origin_netloc == expected.netloc.lower():
        return

    # 2. Allowed if origin netloc matches the request's actual Host / X-Forwarded-Host
    req_host = (
        request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    ).lower()
    if req_host and origin_netloc == req_host:
        return

    # 3. Allowed if local development origins
    if origin_netloc in (
        "localhost",
        "127.0.0.1",
        "localhost:3000",
        "127.0.0.1:3000",
        "localhost:8000",
        "127.0.0.1:8000",
    ):
        return

    raise HTTPException(403, "Invalid request origin.")
