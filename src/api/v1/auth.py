"""Google OAuth 2.0 and Authentication API Endpoints with 7-Day Session State."""

import logging
import secrets
import urllib.parse
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select

from src.core.config import settings
from src.db.models import GoogleUserSession
from src.db.session import AsyncSessionLocal
from src.services.gmail_realtime_poller import gmail_realtime_poller
from src.services.google_auth_service import GoogleAuthService

logger = logging.getLogger("AuthAPI")

router = APIRouter(prefix="/auth", tags=["Authentication & Google OAuth"])


class GoogleStatusResponse(BaseModel):
    configured: bool
    client_id_prefix: str | None = None
    redirect_uri: str
    message: str


class GoogleSyncTokenRequest(BaseModel):
    access_token: str = Field(..., description="Valid Google OAuth access token")
    account_id: str | None = Field(
        default=None, description="Target internal account ID"
    )
    max_results: int = Field(default=50, ge=1, le=100, description="Max emails to scan")


class UserProfileResponse(BaseModel):
    email: str
    name: str
    picture: str | None = None
    session_expires_at: str
    last_synced_at: str | None = None


@router.get("/google/status", response_model=GoogleStatusResponse)
async def get_google_auth_status() -> GoogleStatusResponse:
    """Checks if Google OAuth 2.0 is configured on this deployment."""
    is_conf = GoogleAuthService.is_configured()
    prefix = None
    if is_conf and settings.GOOGLE_CLIENT_ID:
        prefix = f"{settings.GOOGLE_CLIENT_ID[:12]}..."

    msg = (
        "Google Sign-In is configured and ready."
        if is_conf
        else "Google OAuth credentials missing. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env."
    )

    return GoogleStatusResponse(
        configured=is_conf,
        client_id_prefix=prefix,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
        message=msg,
    )


@router.get("/google/login")
async def google_login(
    state: str | None = Query(
        default=None, description="Optional CSRF state parameter"
    ),
    redirect: bool = Query(
        default=True,
        description="Whether to redirect immediately or return JSON URL",
    ),
) -> Any:
    """Generates Google OAuth 2.0 authorization URL and redirects user to Google's consent screen."""
    if not GoogleAuthService.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Google OAuth 2.0 is not configured. "
                "Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file."
            ),
        )

    auth_url = GoogleAuthService.get_authorization_url(state=state)

    if redirect:
        return RedirectResponse(
            url=auth_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT
        )
    return {"authorization_url": auth_url}


@router.get("/google/callback")
async def google_callback(
    code: str | None = Query(default=None, description="OAuth 2.0 authorization code"),
    error: str | None = Query(
        default=None, description="Error returned by Google if denied"
    ),
    state: str | None = Query(default=None, description="CSRF state"),
) -> RedirectResponse:
    """OAuth 2.0 callback endpoint handling Google code exchange, 7-day session creation, and automatic Gmail banking sync."""
    frontend_base = settings.FRONTEND_URL.rstrip("/")

    # Handle error or user cancellation
    if error:
        logger.warning("Google OAuth cancelled or returned error: %s", error)
        params = urllib.parse.urlencode({"google_auth_error": error})
        return RedirectResponse(
            url=f"{frontend_base}?{params}",
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
        )

    if not code:
        logger.error("No code provided in Google OAuth callback.")
        params = urllib.parse.urlencode({"google_auth_error": "no_code_provided"})
        return RedirectResponse(
            url=f"{frontend_base}?{params}",
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
        )

    try:
        # 1. Exchange code for access & refresh tokens
        tokens = await GoogleAuthService.exchange_code_for_tokens(code)
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        expires_in = tokens.get("expires_in", 3600)
        if not access_token:
            raise ValueError("No access_token returned by Google token endpoint")

        # 2. Retrieve user identity
        profile = await GoogleAuthService.get_user_profile(access_token)
        email = profile.get("email", "unknown")
        name = profile.get("name", "User")
        picture = profile.get("picture")
        logger.info("Successfully authenticated Google user: %s (%s)", email, name)

        # 3. Create or update 7-day user session in PostgreSQL
        session_token = secrets.token_urlsafe(32)
        session_expires_at = datetime.now(UTC) + timedelta(days=7)
        token_expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)

        async with AsyncSessionLocal() as db:
            res = await db.execute(
                select(GoogleUserSession).where(GoogleUserSession.email == email)
            )
            existing_session = res.scalar_one_or_none()

            if existing_session:
                existing_session.name = name
                existing_session.picture = picture
                existing_session.access_token = access_token
                if refresh_token:
                    existing_session.refresh_token = refresh_token
                existing_session.token_expires_at = token_expires_at
                existing_session.session_token = session_token
                existing_session.session_expires_at = session_expires_at
                existing_session.last_synced_at = datetime.now(UTC)
            else:
                new_session = GoogleUserSession(
                    id=uuid.uuid4(),
                    email=email,
                    name=name,
                    picture=picture,
                    access_token=access_token,
                    refresh_token=refresh_token,
                    token_expires_at=token_expires_at,
                    session_token=session_token,
                    session_expires_at=session_expires_at,
                    last_synced_at=datetime.now(UTC),
                )
                db.add(new_session)

            await db.commit()

        # 4. Automatically sync Peruvian banking transactions from Gmail
        sync_result = await GoogleAuthService.sync_gmail_transactions(
            access_token=access_token, max_results=50
        )

        params = urllib.parse.urlencode(
            {
                "google_sync": "success",
                "session_token": session_token,
                "email": email,
                "name": name,
                "picture": picture or "",
                "session_expires": session_expires_at.isoformat(),
                "synced": sync_result.get("synced", 0),
                "found": sync_result.get("transactions_found", 0),
            }
        )
        return RedirectResponse(
            url=f"{frontend_base}?{params}",
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
        )

    except Exception as e:
        logger.error("Exception during Google OAuth callback processing: %s", e)
        params = urllib.parse.urlencode({"google_auth_error": str(e)})
        return RedirectResponse(
            url=f"{frontend_base}?{params}",
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
        )


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    authorization: str | None = Header(default=None),
    token: str | None = Query(default=None),
) -> UserProfileResponse:
    """Validates the 7-day session token and returns current user profile."""
    session_tok = None
    if authorization and authorization.startswith("Bearer "):
        session_tok = authorization.split(" ")[1]
    elif token:
        session_tok = token

    if not session_tok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing session token",
        )

    now = datetime.now(UTC)
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(GoogleUserSession).where(
                GoogleUserSession.session_token == session_tok,
                GoogleUserSession.session_expires_at > now,
            )
        )
        user_sess = res.scalar_one_or_none()
        if not user_sess:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired or invalid",
            )

        return UserProfileResponse(
            email=user_sess.email,
            name=user_sess.name or "User",
            picture=user_sess.picture,
            session_expires_at=user_sess.session_expires_at.isoformat(),
            last_synced_at=(
                user_sess.last_synced_at.isoformat()
                if user_sess.last_synced_at
                else None
            ),
        )


@router.post("/google/sync-session")
async def trigger_session_sync(
    authorization: str | None = Header(default=None),
    token: str | None = Query(default=None),
) -> dict[str, Any]:
    """Triggers an immediate on-demand Gmail sync for the authenticated user session."""
    session_tok = None
    if authorization and authorization.startswith("Bearer "):
        session_tok = authorization.split(" ")[1]
    elif token:
        session_tok = token

    if not session_tok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing session token",
        )

    result = await gmail_realtime_poller.sync_user_now(session_tok)
    return result


@router.post("/logout")
async def logout_user(
    authorization: str | None = Header(default=None),
    token: str | None = Query(default=None),
) -> dict[str, str]:
    """Expires the active user session."""
    session_tok = None
    if authorization and authorization.startswith("Bearer "):
        session_tok = authorization.split(" ")[1]
    elif token:
        session_tok = token

    if session_tok:
        async with AsyncSessionLocal() as db:
            res = await db.execute(
                select(GoogleUserSession).where(
                    GoogleUserSession.session_token == session_tok
                )
            )
            sess = res.scalar_one_or_none()
            if sess:
                sess.session_expires_at = datetime.now(UTC)
                await db.commit()

    return {"status": "logged_out"}
