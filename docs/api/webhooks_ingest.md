# API Specification: Webhook Transaction Ingestion

## 1. Overview
* **Endpoint:** `POST /api/v1/webhooks/transactions`
* **Protocol:** HTTP/1.1 or HTTP/2 over TLS
* **Authentication:** Pre-shared secret HMAC-SHA256 signature passed in header `X-Signature-SHA256`
* **Idempotency:** Header `X-Idempotency-Key` or derived `SHA256(account_id + ":" + ext_transaction_id)`
* **Latency SLA:** `p95 < 20ms`, `p99 < 35ms` (Immediate dispatch to Kafka, non-blocking)

---

## 2. Request Headers & Security

| Header Name | Type | Required | Description / Example |
| :--- | :--- | :--- | :--- |
| `Content-Type` | String | Yes | `application/json` |
| `X-Signature-SHA256` | String | Yes | `hex(HMAC_SHA256(payload_bytes, webhook_secret))` |
| `X-Timestamp` | String | Yes | ISO-8601 UTC timestamp (`2026-09-25T16:00:00Z`). Rejected if `|now - timestamp| > 300s`. |
| `X-Bank-Provider` | String | Yes | Institution code: `plaid`, `teller`, `mx`, `chase_direct` |

---

## 3. Request Payload Schema (Pydantic / JSON)

```json
{
  "account_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "ext_transaction_id": "tx_plaid_9942a8b9",
  "amount": 42.50,
  "currency": "USD",
  "raw_description": "SQ *BLUE BOTTLE COFFEE HAYES VALLEY CA 94102 US",
  "transaction_time": "2026-09-25T15:42:10Z",
  "metadata": {
    "pending": false,
    "payment_channel": "in_store"
  }
}
```

### Pydantic Validation Schema (Python 3.12)
```python
from pydantic import BaseModel, Field, UUID4
from decimal import Decimal
from datetime import datetime
from typing import Optional, Dict, Any

class TransactionWebhookPayload(BaseModel):
    account_id: UUID4 = Field(..., description="Internal UUID of registered user account")
    ext_transaction_id: str = Field(..., min_length=4, max_length=255, description="Bank provider's unique transaction identifier")
    amount: Decimal = Field(..., max_digits=12, decimal_places=2, description="Transaction amount (positive for debits/expenses)")
    currency: str = Field(default="USD", min_length=3, max_length=3)
    raw_description: str = Field(..., min_length=1, max_length=500, description="Raw, unparsed bank payee line")
    transaction_time: datetime = Field(..., description="Timestamp of transaction occurrence")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
```

---

## 4. Response Schemas

### 202 Accepted (Standard Success)
Returned as soon as the message is validated and acknowledged by the Kafka producer.

```json
{
  "status": "accepted",
  "tracking_id": "evt_01J8K3P9M12ABCDEF",
  "received_at": "2026-09-25T16:00:01.104Z",
  "deduplicated": false
}
```

### 200 OK (Duplicate Ignored)
Returned if the idempotency key was previously processed in Redis within the 24-hour deduplication window.

```json
{
  "status": "duplicate_ignored",
  "tracking_id": "evt_01J8K3P9M12ABCDEF",
  "message": "Transaction already acknowledged and scheduled for processing."
}
```

### Error Responses

| Status Code | Code String | Trigger Scenario | Example Payload |
| :--- | :--- | :--- | :--- |
| `401 Unauthorized` | `INVALID_SIGNATURE` | HMAC verification failed | `{"error": "INVALID_SIGNATURE", "detail": "HMAC-SHA256 signature does not match payload."}` |
| `400 Bad Request` | `EXPIRED_TIMESTAMP` | Payload timestamp drifted > 300s | `{"error": "EXPIRED_TIMESTAMP", "detail": "Request timestamp too skewed."}` |
| `422 Unprocessable`| `VALIDATION_ERROR` | Schema validation error (e.g. missing amount) | Standard FastAPI Pydantic detail |
| `503 Service Unavail`| `STREAM_BACKPRESSURE`| Kafka cluster unreachable / buffer full | `{"error": "STREAM_BACKPRESSURE", "retry_after": 5}` |
