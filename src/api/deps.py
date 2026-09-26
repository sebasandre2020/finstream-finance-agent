"""Security, Authentication, and Signature Verification Dependencies."""

import hashlib
import hmac
from datetime import UTC, datetime

from fastapi import Header, HTTPException, Request, status

from src.core.config import settings


async def verify_webhook_signature(
    request: Request,
    x_signature_sha256: str = Header(..., alias="X-Signature-SHA256"),
    x_timestamp: str = Header(..., alias="X-Timestamp"),
) -> bytes:
    """
    Verifies that the incoming bank webhook is signed with the pre-shared secret
    and that the timestamp has not drifted more than 300 seconds (replay attack protection).
    """
    # 1. Replay attack mitigation
    try:
        req_dt = datetime.fromisoformat(x_timestamp.replace("Z", "+00:00"))
        now_dt = datetime.now(UTC)
        skew_seconds = abs((now_dt - req_dt).total_seconds())
        if skew_seconds > 300:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Request timestamp expired. Time skew of {skew_seconds:.1f}s exceeds 300s window.",
            )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-Timestamp header format. Expected ISO-8601 UTC string.",
        ) from err

    # 2. Read raw request body
    body_bytes = await request.body()
    if not body_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty webhook request body.",
        )

    # 3. Compute HMAC-SHA256
    expected_signature = hmac.new(
        key=settings.WEBHOOK_SIGNING_SECRET.encode("utf-8"),
        msg=body_bytes,
        digestmod=hashlib.sha256,
    ).hexdigest()

    # 4. Constant-time comparison
    if not hmac.compare_digest(x_signature_sha256, expected_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid HMAC-SHA256 webhook signature.",
        )

    return body_bytes
