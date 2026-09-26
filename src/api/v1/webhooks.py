"""Banking Partner Webhook Ingestion Endpoint."""

import json
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response, status

from src.api.deps import verify_webhook_signature
from src.schemas.transaction import TransactionIngestAck, TransactionWebhookPayload
from src.services.idempotency import idempotency_service
from src.services.kafka_producer import kafka_producer_service

router = APIRouter(prefix="/webhooks", tags=["Webhooks Ingestion"])


@router.post(
    "/transactions",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=TransactionIngestAck,
    summary="Ingest raw banking webhook transaction",
    description="Validates HMAC signature, checks idempotency in Redis, and asynchronously produces event to Kafka.",
)
async def ingest_transaction_webhook(
    response: Response, payload_bytes: bytes = Depends(verify_webhook_signature)
) -> TransactionIngestAck:
    # 1. Parse JSON payload
    raw_dict = json.loads(payload_bytes.decode("utf-8"))
    payload = TransactionWebhookPayload.model_validate(raw_dict)

    tracking_id = f"evt_{uuid.uuid4().hex[:16]}"
    account_str = str(payload.account_id)
    now_dt = datetime.now(UTC)

    # 2. Check Idempotency Lock in Redis
    is_new = await idempotency_service.check_and_set(
        account_str, payload.ext_transaction_id
    )
    if not is_new:
        # Acknowledge duplicate without reprocessing or producing to Kafka
        response.status_code = status.HTTP_200_OK
        return TransactionIngestAck(
            status="duplicate_ignored",
            tracking_id=tracking_id,
            received_at=now_dt,
            deduplicated=True,
        )

    # 3. Publish to Kafka Topic partitioned by account_id
    envelope = {
        "tracking_id": tracking_id,
        "received_at": now_dt.isoformat(),
        "payload": payload.model_dump(mode="json"),
    }
    await kafka_producer_service.publish_transaction_event(
        account_id=account_str,
        ext_transaction_id=payload.ext_transaction_id,
        payload=envelope,
    )

    return TransactionIngestAck(
        status="accepted",
        tracking_id=tracking_id,
        received_at=now_dt,
        deduplicated=False,
    )
