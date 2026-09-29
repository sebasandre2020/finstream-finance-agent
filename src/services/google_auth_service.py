"""Google OAuth 2.0 and Gmail REST API Service for Automated Banking Ingestion."""

import base64
import logging
import re
import secrets
import urllib.parse
import uuid
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import select

from src.core.config import settings
from src.db.models import Account, Transaction
from src.db.session import AsyncSessionLocal
from src.schemas.transaction import TransactionWebhookPayload
from src.services.email_parser import email_parser_service
from src.services.idempotency import idempotency_service
from src.services.kafka_producer import kafka_producer_service

logger = logging.getLogger("GoogleAuthService")

GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GMAIL_MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages"

GMAIL_BANK_QUERY = (
    "(from:(bcp.com.pe OR viabcp.com OR viabcp.pe OR yape.com.pe OR yape.pe "
    "OR notificacionesbcp.com.pe OR bcp.pe OR email.bcp.com.pe OR avisosbcp.com.pe "
    "OR bancodecredito OR bbva.com.pe OR bbva.pe OR bancofalabella.com OR interbank.pe OR scotiabank.com.pe) "
    "OR subject:(BCP OR Yape OR Viabcp OR 'Banco de Crédito' OR BBVA OR PLIN OR Plineaste "
    "OR 'Constancia de operación' OR 'Constancia de operacion' OR 'Notificación de Operación' "
    "OR 'Notificación de Consumo' OR 'Pago de Servicios' OR 'Transferencia' OR Falabella OR CMR))"
)


class GoogleAuthService:
    """Handles Google OAuth 2.0 flow and fetches banking notification emails via Gmail API."""

    @classmethod
    def is_configured(cls) -> bool:
        """Checks if Google OAuth client credentials are properly configured."""
        return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)

    @classmethod
    def get_authorization_url(cls, state: str | None = None) -> str:
        """Constructs Google OAuth 2.0 consent URL requesting read-only Gmail access."""
        if not cls.is_configured():
            raise ValueError(
                "Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are not configured."
            )

        csrf_state = state or secrets.token_urlsafe(16)
        scopes = [
            "openid",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/gmail.readonly",
        ]

        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": " ".join(scopes),
            "access_type": "offline",
            "prompt": "consent",
            "state": csrf_state,
        }

        return f"{GOOGLE_AUTH_BASE_URL}?{urllib.parse.urlencode(params)}"

    @classmethod
    async def exchange_code_for_tokens(cls, code: str) -> dict[str, Any]:
        """Exchanges Google authorization code for access and refresh tokens."""
        if not cls.is_configured():
            raise ValueError("Google OAuth credentials are not configured.")

        data = {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(GOOGLE_TOKEN_URL, data=data)
            if resp.status_code != 200:
                logger.error(
                    "Google token exchange failed: %d - %s",
                    resp.status_code,
                    "[redacted]",
                )
                raise ValueError("Failed to exchange Google code")
            return resp.json()

    @classmethod
    async def refresh_access_token(cls, refresh_token: str) -> dict[str, Any]:
        """Exchanges Google refresh token for a fresh access token."""
        if not cls.is_configured():
            raise ValueError("Google OAuth credentials are not configured.")

        data = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(GOOGLE_TOKEN_URL, data=data)
            if resp.status_code != 200:
                raise ValueError("Google token refresh failed")
            return resp.json()

    @classmethod
    async def get_user_profile(cls, access_token: str) -> dict[str, Any]:
        """Fetches the authenticated user's Google email and profile."""
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(GOOGLE_USERINFO_URL, headers=headers)
            if resp.status_code != 200:
                logger.warning(
                    "Failed to fetch Google user profile: %d", resp.status_code
                )
                return {}
            return resp.json()

    @classmethod
    def _decode_b64url(cls, data: str) -> str:
        """Safely decodes base64url encoded email part."""
        try:
            padded = data + "=" * (-len(data) % 4)
            return base64.urlsafe_b64decode(padded.encode()).decode(
                "utf-8", errors="replace"
            )
        except Exception:
            return ""

    @classmethod
    def _extract_body_from_payload(cls, payload: dict[str, Any]) -> str:
        """Recursively extracts plain-text or HTML email body from Gmail message payload."""
        body_obj = payload.get("body", {})
        if body_obj.get("data"):
            decoded = cls._decode_b64url(body_obj["data"])
            if decoded:
                return decoded

        parts = payload.get("parts", [])
        plain_text = ""
        html_text = ""

        for part in parts:
            mime = part.get("mimeType", "")
            part_data = part.get("body", {}).get("data", "")
            if part_data:
                decoded = cls._decode_b64url(part_data)
                if mime == "text/plain" and not plain_text:
                    plain_text = decoded
                elif mime == "text/html" and not html_text:
                    html_text = decoded

            if "parts" in part:
                nested = cls._extract_body_from_payload(part)
                if nested:
                    return nested

        return plain_text or html_text

    @classmethod
    def _get_header(cls, headers: list[dict[str, str]], header_name: str) -> str:
        """Retrieves a header value by case-insensitive name."""
        target = header_name.lower()
        for h in headers:
            if h.get("name", "").lower() == target:
                return h.get("value", "")
        return ""

    @classmethod
    async def sync_gmail_transactions(
        cls,
        access_token: str,
        user_id: uuid.UUID,
        max_results: int = 100,
    ) -> dict[str, Any]:
        """Queries Gmail API for Peruvian banking emails, parses and publishes transactions to Kafka."""
        headers = {"Authorization": f"Bearer {access_token}"}
        target_account_id = user_id
        acct_str = str(target_account_id)

        logger.info(
            "Initiating Gmail sync for account %s with query: '%s'",
            target_account_id,
            GMAIL_BANK_QUERY,
        )

        async with httpx.AsyncClient(timeout=25.0) as client:
            messages_meta: list[dict[str, Any]] = []
            page_token = None
            pages_fetched = 0

            # Fetch up to 2 pages (up to 200 emails)
            while pages_fetched < 2:
                search_params = {
                    "q": GMAIL_BANK_QUERY,
                    "maxResults": min(max_results, 100),
                }
                if page_token:
                    search_params["pageToken"] = page_token

                list_resp = await client.get(
                    GMAIL_MESSAGES_URL, headers=headers, params=search_params
                )
                if list_resp.status_code != 200:
                    logger.error(
                        "Gmail messages list failed (%d): %s",
                        list_resp.status_code,
                        list_resp.text,
                    )
                    raise ValueError("Gmail access failed; reconnect Google")

                data = list_resp.json()
                page_msgs = data.get("messages", [])
                messages_meta.extend(page_msgs)
                pages_fetched += 1
                page_token = data.get("nextPageToken")
                if not page_token or not page_msgs:
                    break

            logger.info(
                "Found %d candidate banking messages in Gmail.", len(messages_meta)
            )

            inspected_count = 0
            found_count = 0
            synced_count = 0
            synced_transactions: list[dict[str, Any]] = []

            for msg_item in messages_meta:
                msg_id = msg_item.get("id")
                if not msg_id:
                    continue

                msg_resp = await client.get(
                    f"{GMAIL_MESSAGES_URL}/{msg_id}",
                    headers=headers,
                    params={"format": "full"},
                )
                if msg_resp.status_code != 200:
                    continue

                inspected_count += 1
                msg_data = msg_resp.json()
                payload = msg_data.get("payload", {})
                msg_headers = payload.get("headers", [])

                sender = cls._get_header(msg_headers, "From")
                subject = cls._get_header(msg_headers, "Subject")
                date_str = cls._get_header(msg_headers, "Date")
                email_dt = None
                if date_str:
                    try:
                        from email.utils import parsedate_to_datetime

                        email_dt = parsedate_to_datetime(date_str).astimezone(UTC)
                    except Exception:
                        email_dt = None

                body = cls._extract_body_from_payload(payload)

                if not body:
                    continue

                parsed = await email_parser_service.parse_email(
                    raw_body=body,
                    sender=sender,
                    subject=subject,
                    email_id=msg_id,
                    email_date_header=email_dt,
                )

                if not parsed.is_transaction or not parsed.amount:
                    continue

                found_count += 1

                # Differentiate cards, digital wallets, and bank accounts
                card_or_acct = parsed.card_or_account or "Default"
                card_str = str(card_or_acct).upper()
                desc_upper = parsed.raw_description.upper()
                sender_upper = str(sender).upper()
                source_meta = str(parsed.metadata.get("source", "")).upper()

                # 1. Yape
                if source_meta == "YAPE" or "YAPE" in desc_upper or "YAPE" in card_str:
                    institution = "Yape"
                    mask = "YAPE"

                # 2. BBVA Card Consumption
                elif (
                    source_meta == "BBVA_CARD"
                    or "BBVA CARD" in desc_upper
                    or ("BBVA" in sender_upper and "TARJETA" in desc_upper)
                ):
                    digits = re.findall(r"\d{4}", card_str)
                    mask = f"*{digits[0]}" if digits else "*4079"
                    institution = "BBVA Tarjeta"

                # 3. BBVA Plin Transfers (sent or received via Plin)
                elif source_meta == "PLIN_TRANSFER" or (
                    "PLIN" in desc_upper
                    and (
                        "BBVA" in sender_upper
                        or "PLINEASTE" in desc_upper
                        or "TE PLINEARON" in desc_upper
                    )
                ):
                    institution = "BBVA Plin"
                    mask = "PLIN"

                # 4. Falabella CMR Card
                elif (
                    source_meta == "FALABELLA_CMR"
                    or "CMR" in desc_upper
                    or "FALABELLA" in sender_upper
                ):
                    digits = re.findall(r"\d{4}", card_str)
                    mask = f"*{digits[0]}" if digits else "*4422"
                    institution = "Banco Falabella CMR"

                # 5. BCP Card Consumption or Card Transfer
                elif (
                    source_meta == "BCP_CARD"
                    or "BCP CARD" in desc_upper
                    or "NOTIFICACIONESBCP" in sender_upper
                    or ("CARD" in card_str and "BCP" in (sender_upper + desc_upper))
                ):
                    digits = re.findall(r"\d{4}", card_str)
                    mask = f"*{digits[0]}" if digits else "*8590"
                    institution = "BCP Tarjeta"

                # 6. BCP Services & Utilities
                elif (
                    "SERVICIO" in desc_upper
                    or "PAGO" in desc_upper
                    or "RECIBO" in desc_upper
                ):
                    institution = "BCP Pagos y Servicios"
                    mask = "*PAGOS"

                # 7. BCP Transfers / Accounts
                elif (
                    "TRANSFER" in desc_upper
                    or "CUENTA" in card_str
                    or "BENEFICIARIO" in desc_upper
                ):
                    digits = re.findall(r"\d{4}", card_str)
                    mask = f"*{digits[0]}" if digits else "*ACCT"
                    institution = "BCP Transferencia / Cuenta"

                # 8. Default fallback
                else:
                    digits = re.findall(r"\d{4}", card_str)
                    if digits:
                        mask = f"*{digits[0]}"
                        institution = "BCP Tarjeta"
                    else:
                        mask = "*0000"
                        institution = "BCP Banco de Crédito"

                card_account_id = uuid.uuid5(
                    user_id, f"{institution}_{mask}_{parsed.currency}"
                )
                async with AsyncSessionLocal() as db:
                    account = (
                        await db.execute(
                            select(Account)
                            .where(
                                Account.user_id == user_id,
                                Account.institution_name == institution,
                                Account.account_number_mask == mask,
                                Account.currency == parsed.currency,
                            )
                            .order_by(Account.created_at, Account.id)
                            .limit(1)
                        )
                    ).scalar_one_or_none()
                    if account:
                        card_account_id = account.id
                    else:
                        db.add(
                            Account(
                                id=card_account_id,
                                user_id=user_id,
                                institution_name=institution,
                                account_number_mask=mask,
                                currency=parsed.currency,
                            )
                        )
                        await db.commit()
                    duplicate = await db.scalar(
                        select(Transaction.id).where(
                            Transaction.account_id == card_account_id,
                            Transaction.ext_transaction_id == parsed.ext_transaction_id,
                        )
                    )
                    if duplicate:
                        continue
                acct_str = str(card_account_id)

                is_new = await idempotency_service.check_and_set(
                    account_id=acct_str,
                    ext_transaction_id=parsed.ext_transaction_id,
                )

                if not is_new:
                    logger.info(
                        "Transaction %s is queued for processing. Skipping duplicate.",
                        parsed.ext_transaction_id,
                    )
                    continue

                tx_payload = TransactionWebhookPayload(
                    account_id=card_account_id,
                    ext_transaction_id=parsed.ext_transaction_id,
                    amount=(
                        -abs(parsed.amount)
                        if parsed.operation_type == "CREDIT"
                        else parsed.amount
                    ),
                    currency=parsed.currency,
                    raw_description=parsed.raw_description,
                    transaction_time=parsed.transaction_time,
                )

                event_dict = tx_payload.model_dump(mode="json")
                event_dict["source"] = "gmail_oauth_sync"
                event_dict["gmail_msg_id"] = msg_id
                event_dict["parser_used"] = parsed.parser_used
                event_dict["card_or_account"] = parsed.card_or_account
                event_dict["institution_name"] = institution
                event_dict["account_number_mask"] = mask

                envelope = {
                    "tracking_id": f"evt_gmail_{parsed.ext_transaction_id}",
                    "received_at": datetime.now(UTC).isoformat(),
                    "payload": event_dict,
                }

                try:
                    published = await kafka_producer_service.publish_transaction_event(
                        account_id=acct_str,
                        ext_transaction_id=parsed.ext_transaction_id,
                        payload=envelope,
                    )
                except Exception:
                    redis = await idempotency_service.get_client()
                    await redis.delete(
                        idempotency_service.generate_key(
                            acct_str, parsed.ext_transaction_id
                        )
                    )
                    raise
                if published:
                    synced_count += 1
                    synced_transactions.append(
                        {
                            "ext_transaction_id": parsed.ext_transaction_id,
                            "merchant": parsed.merchant,
                            "amount": parsed.amount,
                            "currency": parsed.currency,
                            "operation_type": parsed.operation_type,
                            "transaction_time": parsed.transaction_time.isoformat(),
                        }
                    )
                else:
                    redis = await idempotency_service.get_client()
                    await redis.delete(
                        idempotency_service.generate_key(
                            acct_str, parsed.ext_transaction_id
                        )
                    )
                    raise ValueError("Transaction queue unavailable; retry sync")

            logger.info(
                "Gmail sync completed: %d inspected, %d transactions found, %d synced to Kafka.",
                inspected_count,
                found_count,
                synced_count,
            )

            return {
                "status": "success",
                "inspected": inspected_count,
                "transactions_found": found_count,
                "synced": synced_count,
                "transactions": synced_transactions,
            }
