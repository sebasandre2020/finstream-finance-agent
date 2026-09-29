"""Unit tests for Google OAuth 2.0 and Gmail Banking Ingestion Service."""

import base64
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.core.config import settings
from src.services.google_auth_service import GoogleAuthService


def test_google_auth_is_configured():
    with patch.object(settings, "GOOGLE_CLIENT_ID", None):
        assert not GoogleAuthService.is_configured()

    with (
        patch.object(settings, "GOOGLE_CLIENT_ID", "test-client-id"),
        patch.object(settings, "GOOGLE_CLIENT_SECRET", "test-secret"),
    ):
        assert GoogleAuthService.is_configured()


def test_google_auth_authorization_url_generation():
    with (
        patch.object(settings, "GOOGLE_CLIENT_ID", "dummy-client-id"),
        patch.object(settings, "GOOGLE_CLIENT_SECRET", "dummy-secret"),
        patch.object(
            settings,
            "GOOGLE_REDIRECT_URI",
            "http://localhost:8000/api/v1/auth/google/callback",
        ),
    ):
        url = GoogleAuthService.get_authorization_url(state="test_state_123")
        assert "accounts.google.com/o/oauth2/v2/auth" in url
        assert "client_id=dummy-client-id" in url
        assert "state=test_state_123" in url
        assert "gmail.readonly" in url
        assert "response_type=code" in url


def test_decode_b64url():
    sample_text = "Operacion: Consumo\nComercio: RAPPI PERU\nImporte: S/ 45.00"
    encoded = base64.urlsafe_b64encode(sample_text.encode()).decode().rstrip("=")
    decoded = GoogleAuthService._decode_b64url(encoded)
    assert decoded == sample_text


def test_extract_body_from_payload_direct():
    sample = "Monto: S/ 100.00"
    b64 = base64.urlsafe_b64encode(sample.encode()).decode()
    payload = {"body": {"data": b64}}
    extracted = GoogleAuthService._extract_body_from_payload(payload)
    assert extracted == sample


def test_extract_body_from_payload_multipart():
    sample_plain = "Comercio: STARBUCKS\nImporte: S/ 18.50"
    sample_html = "<p>Comercio: STARBUCKS<br>Importe: S/ 18.50</p>"
    b64_plain = base64.urlsafe_b64encode(sample_plain.encode()).decode()
    b64_html = base64.urlsafe_b64encode(sample_html.encode()).decode()

    payload = {
        "parts": [
            {"mimeType": "text/html", "body": {"data": b64_html}},
            {"mimeType": "text/plain", "body": {"data": b64_plain}},
        ]
    }
    extracted = GoogleAuthService._extract_body_from_payload(payload)
    assert "STARBUCKS" in extracted


def test_get_header():
    headers = [
        {"name": "From", "value": "notificaciones@bcp.com.pe"},
        {"name": "Subject", "value": "Constancia de Operacion"},
        {"name": "Date", "value": "Sat, 26 Sep 2026 14:00:00 -0500"},
    ]
    assert GoogleAuthService._get_header(headers, "from") == "notificaciones@bcp.com.pe"
    assert (
        GoogleAuthService._get_header(headers, "SUBJECT") == "Constancia de Operacion"
    )
    assert GoogleAuthService._get_header(headers, "NonExistent") == ""


@pytest.mark.asyncio
async def test_sync_gmail_transactions_mocked():
    sample_bcp_body = (
        "Operacion: Consumo\n"
        "Comercio: TOTTUS SAN ISIDRO\n"
        "Importe: S/ 142.80\n"
        "Fecha y hora: 26/09/2026 12:30:00\n"
        "Tarjeta ...3910"
    )
    b64_body = base64.urlsafe_b64encode(sample_bcp_body.encode()).decode()

    fake_messages_list = {"messages": [{"id": "msg_001"}]}

    fake_message_detail = {
        "id": "msg_001",
        "payload": {
            "headers": [
                {"name": "From", "value": "notificaciones@bcp.com.pe"},
                {"name": "Subject", "value": "Constancia de Operacion - Consumo"},
            ],
            "body": {"data": b64_body},
        },
    }

    class MockResponse:
        def __init__(self, status_code, json_data):
            self.status_code = status_code
            self._json = json_data
            self.text = str(json_data)

        def json(self):
            return self._json

    async def mock_get(url, headers=None, params=None):
        if "messages/msg_001" in url:
            return MockResponse(200, fake_message_detail)
        elif "messages" in url:
            return MockResponse(200, fake_messages_list)
        return MockResponse(404, {})

    with (
        patch("httpx.AsyncClient.get", side_effect=mock_get),
        patch(
            "src.services.idempotency.idempotency_service.check_and_set",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch(
            "src.services.kafka_producer.kafka_producer_service.publish_transaction_event",
            new_callable=AsyncMock,
            return_value=True,
        ),
        patch("src.services.google_auth_service.AsyncSessionLocal") as mock_db,
    ):
        mock_session = AsyncMock()
        mock_db.return_value.__aenter__.return_value = mock_session
        mock_acct_res = MagicMock()
        mock_acct_res.scalar_one_or_none.return_value = MagicMock(id=uuid.uuid4())
        mock_session.execute.return_value = mock_acct_res
        mock_session.scalar.return_value = None
        result = await GoogleAuthService.sync_gmail_transactions(
            access_token="fake_access_token_123",
            user_id=uuid.UUID("b0000000-0000-0000-0000-000000000001"),
        )

        assert result["status"] == "success"
        assert result["inspected"] == 1
        assert result["transactions_found"] == 1
        assert result["synced"] == 1
        assert len(result["transactions"]) == 1
        assert result["transactions"][0]["merchant"] == "TOTTUS SAN ISIDRO"
        assert result["transactions"][0]["amount"] == 142.80
