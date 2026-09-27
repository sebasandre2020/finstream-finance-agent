"""Email Ingestion and Parsing API Endpoints."""

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, status

from src.schemas.email import (
    EmailIngestResponse,
    EmailParseRequest,
    EmailTransactionResult,
    GmailSyncRequest,
    GmailSyncResponse,
)
from src.schemas.transaction import TransactionWebhookPayload
from src.services.email_parser import email_parser_service
from src.services.email_watcher import email_watcher_service
from src.services.idempotency import idempotency_service
from src.services.kafka_producer import kafka_producer_service

router = APIRouter(prefix="/email", tags=["Email Banking Ingestion"])


@router.post(
    "/parse",
    response_model=EmailTransactionResult,
    summary="Parse raw banking email content (dry run)",
    description="Tests regex templates and LLM fallback on raw email content without producing Kafka events.",
)
async def parse_email_content(req: EmailParseRequest) -> EmailTransactionResult:
    return await email_parser_service.parse_email(
        raw_body=req.body, sender=req.sender, subject=req.subject
    )


@router.post(
    "/ingest",
    response_model=EmailIngestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Parse and immediately ingest an email notification into the live pipeline",
    description="Parses transaction, applies Redis idempotency, produces to Kafka, and streams live to the dashboard.",
)
async def ingest_email_content(req: EmailParseRequest) -> EmailIngestResponse:
    res = await email_parser_service.parse_email(
        raw_body=req.body, sender=req.sender, subject=req.subject
    )

    if not res.is_transaction or not res.amount or not res.ext_transaction_id:
        return EmailIngestResponse(
            status="not_a_transaction",
            transaction=res,
            message="Email was inspected but did not contain recognizable financial transaction data.",
        )

    acct_id = req.account_id or uuid.UUID("b0000000-0000-0000-0000-000000000001")
    acct_str = str(acct_id)

    # Redis Idempotency
    is_new = await idempotency_service.check_and_set(
        account_id=acct_str,
        ext_transaction_id=res.ext_transaction_id,
    )
    if not is_new:
        return EmailIngestResponse(
            status="duplicate_ignored",
            transaction=res,
            message=f"Transaction with ID '{res.ext_transaction_id}' already processed.",
        )

    # Produce to Kafka
    tracking_id = f"evt_eml_{uuid.uuid4().hex[:12]}"
    now_dt = datetime.now(UTC)

    payload = TransactionWebhookPayload(
        account_id=acct_id,
        ext_transaction_id=res.ext_transaction_id,
        amount=res.amount,
        currency=res.currency,
        raw_description=res.raw_description or res.merchant or "EMAIL TX",
        transaction_time=res.transaction_time or now_dt,
        metadata={
            "parser": res.parser_used,
            "card": res.card_or_account,
            "source": "email_ingest_api",
        },
    )

    envelope = {
        "tracking_id": tracking_id,
        "received_at": now_dt.isoformat(),
        "payload": payload.model_dump(mode="json"),
    }
    await kafka_producer_service.publish_transaction_event(
        account_id=acct_str,
        ext_transaction_id=res.ext_transaction_id,
        payload=envelope,
    )

    return EmailIngestResponse(
        status="ingested",
        tracking_id=tracking_id,
        transaction=res,
        message="Transaction successfully parsed and published to Kafka.",
    )


@router.post(
    "/sync",
    response_model=GmailSyncResponse,
    summary="Trigger live Gmail inbox sync for BCP/Yape transactions",
    description="Connects via IMAP to Gmail with user's App Password, discovers unread transaction alerts, and streams them.",
)
async def sync_gmail(req: GmailSyncRequest) -> GmailSyncResponse:
    return await email_watcher_service.sync_gmail_inbox(
        email_address=req.email_address,
        app_password=req.app_password,
        account_id=req.account_id,
        max_emails=req.max_emails,
        unread_only=req.unread_only,
    )


@router.get(
    "/presets",
    summary="Get realistic sample BCP and Yape notification templates",
    description="Returns pre-formatted email templates from BCP and Yape in Peru for instant testing.",
)
async def get_email_presets() -> dict[str, Any]:
    return {
        "bcp_card_debit": {
            "title": "BCP Consumo Tarjeta Débito (Rappi)",
            "sender": "notificaciones@bcp.com.pe",
            "subject": "Constancia de Operación - Consumo",
            "body": """Estimado(a) Cliente:
Le informamos que se ha realizado una operación con su Tarjeta Credimás Débito BCP N° ...4921
Operación: Consumo
Comercio: RAPPI PERU
Importe: S/ 46.50
Fecha y hora: 26/09/2026 14:15:22
Canal: POS / Internet
Si no reconoce esta operación, comuníquese inmediatamente con nuestra Banca por Teléfono.""",
        },
        "bcp_card_starbucks": {
            "title": "BCP Tarjeta de Crédito (Starbucks)",
            "sender": "bancodecredito@bcp.com.pe",
            "subject": "Notificación de Consumo con Tarjeta BCP",
            "body": """Hola SEBASTIAN,
Registramos un consumo con tu Tarjeta Visa Signature BCP terminada en 8812.
Establecimiento: STARBUCKS JOCKEY PLAZA
Monto: S/ 18.50
Fecha y hora: 26/09/2026 14:30
Gracias por usar tus tarjetas BCP.""",
        },
        "yape_sent": {
            "title": "Yape Enviado (Restaurante)",
            "sender": "notificaciones@yape.com.pe",
            "subject": "¡Yapeaste!",
            "body": """¡Yapeaste con éxito!
Enviaste dinero a: CEBICHERIA LA MAR SAC
Monto: S/ 78.00
Fecha: 26/09/2026 - 14:35
Nro. de Operación: 94810294
¡Gracias por yapear!""",
        },
        "bcp_transfer": {
            "title": "Transferencia BCP a Terceros",
            "sender": "avisos@viabcp.com",
            "subject": "Constancia de Transferencia a Terceros BCP",
            "body": """Constancia de Operación
Detalle de la transferencia:
Cuenta Origen: Cuenta Sueldo BCP ...3019
Beneficiario: CLINICA SAN FELIPE
Importe: S/ 250.00
Fecha: 26/09/2026 a las 11:20
Número de operación: 00481920""",
        },
    }
