"""Google OAuth restoration with browser-bound state and HttpOnly sessions."""

import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.session import (
    SESSION_COOKIE,
    require_same_origin,
    require_user,
    token_digest,
)
from src.core.config import settings
from src.db.models import GoogleUserSession
from src.db.session import get_db
from src.services.google_auth_service import GoogleAuthService
from src.services.idempotency import idempotency_service

router = APIRouter(prefix="/auth", tags=["Google sign-in"])
logger = logging.getLogger(__name__)
STATE_COOKIE = "finstream_oauth_state"


def secure_cookie():
    return settings.FRONTEND_URL.startswith("https://")


def profile(user):
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name or "Your account",
        "session_expires_at": user.session_expires_at.isoformat(),
        "last_synced_at": (
            user.last_synced_at.isoformat() if user.last_synced_at else None
        ),
    }


@router.get("/google/status")
async def google_status():
    return {
        "configured": GoogleAuthService.is_configured(),
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
    }


@router.get("/google/login")
async def google_login():
    if not GoogleAuthService.is_configured():
        raise HTTPException(503, "Google sign-in is not configured on this server.")
    state = secrets.token_urlsafe(32)
    redis = await idempotency_service.get_client()
    await redis.set("oauth:state:" + token_digest(state), "pending", ex=600)
    response = RedirectResponse(
        GoogleAuthService.get_authorization_url(state), status_code=303
    )
    response.set_cookie(
        STATE_COOKIE,
        state,
        max_age=600,
        httponly=True,
        secure=secure_cookie(),
        samesite="lax",
        path="/api/v1/auth",
    )
    response.headers["Cache-Control"] = "no-store"
    return response


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    def redirect(problem=None):
        response = RedirectResponse(
            settings.FRONTEND_URL.rstrip("/")
            + ("/?google_auth_error=" + problem if problem else "/"),
            status_code=303,
        )
        response.delete_cookie(STATE_COOKIE, path="/api/v1/auth")
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    expected = request.cookies.get(STATE_COOKIE, "")
    if not state or not expected or not secrets.compare_digest(state, expected):
        return redirect("invalid_state")
    redis = await idempotency_service.get_client()
    if not await redis.getdel("oauth:state:" + token_digest(state)):
        return redirect("expired_state")
    if error or not code:
        return redirect("cancelled")
    try:
        tokens = await GoogleAuthService.exchange_code_for_tokens(code)
        identity = await GoogleAuthService.get_user_profile(tokens["access_token"])
        if (
            not identity.get("sub")
            or identity.get("email_verified") is not True
            or not identity.get("email")
        ):
            raise ValueError("Google identity could not be verified")
        user = (
            await db.execute(
                select(GoogleUserSession).where(
                    GoogleUserSession.google_subject == identity["sub"]
                )
            )
        ).scalar_one_or_none()
        if not user:
            # Preserve the existing profile's stable id after a verified login.
            user = (
                await db.execute(
                    select(GoogleUserSession).where(
                        GoogleUserSession.email == identity["email"]
                    )
                )
            ).scalar_one_or_none()
            if user and user.google_subject and user.google_subject != identity["sub"]:
                raise ValueError("Identity mismatch")
        if not user:
            user = GoogleUserSession(id=uuid.uuid4(), email=identity["email"])
            db.add(user)
        now = datetime.now(timezone.utc)
        session_token = secrets.token_urlsafe(32)
        user.google_subject = identity["sub"]
        user.name = identity.get("name", "Your account")
        user.picture = identity.get("picture")
        user.access_token = tokens["access_token"]
        if tokens.get("refresh_token"):
            user.refresh_token = tokens["refresh_token"]
        user.token_expires_at = now + timedelta(
            seconds=int(tokens.get("expires_in", 3600))
        )
        user.session_token = token_digest(session_token)
        user.session_expires_at = now + timedelta(days=7)
        await db.commit()
        response = redirect()
        response.set_cookie(
            SESSION_COOKIE,
            session_token,
            max_age=7 * 86400,
            httponly=True,
            secure=secure_cookie(),
            samesite="lax",
            path="/",
        )
        return response
    except Exception:
        await db.rollback()
        logger.warning("Google sign-in failed; no session issued")
        return redirect("sign_in_failed")


@router.get("/me")
async def me(user: GoogleUserSession = Depends(require_user)):
    return JSONResponse(profile(user), headers={"Cache-Control": "no-store"})


@router.post("/logout", dependencies=[Depends(require_same_origin)])
async def logout(
    user: GoogleUserSession = Depends(require_user), db: AsyncSession = Depends(get_db)
):
    user.session_expires_at = datetime.now(timezone.utc)
    await db.commit()
    response = JSONResponse({"status": "signed_out"})
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response


@router.post("/google/sync-session", dependencies=[Depends(require_same_origin)])
async def sync(user: GoogleUserSession = Depends(require_user)):
    from src.services.gmail_realtime_poller import gmail_realtime_poller

    try:
        return await gmail_realtime_poller.request_sync(user.id)
    except Exception:
        raise HTTPException(
            502, "Gmail sync failed. Try again or reconnect your Google account."
        )


@router.get("/google/sync-status")
async def sync_status(user: GoogleUserSession = Depends(require_user)):
    from src.services.gmail_realtime_poller import gmail_realtime_poller

    return JSONResponse(
        await gmail_realtime_poller.status(user.id),
        headers={"Cache-Control": "no-store"},
    )
