"""Pydantic v2 schemas for transaction ingestion, queries, and anomaly alerts."""

import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class TransactionWebhookPayload(BaseModel):
    """Raw payload delivered by banking provider webhooks (e.g. Plaid, Teller, MX)."""
    model_config = ConfigDict(from_attributes=True)

    account_id: uuid.UUID = Field(
        ...,
        description="Internal account identifier mapped to user"
    )
    ext_transaction_id: str = Field(
        ...,
        min_length=3,
        max_length=255,
        description="Bank provider's unique immutable transaction identifier"
    )
    amount: Decimal = Field(
        ...,
        max_digits=12,
        decimal_places=2,
        description="Transaction amount (positive for debits/expenses, negative for credits/refunds)"
    )
    currency: str = Field(
        default="USD",
        min_length=3,
        max_length=3,
        description="ISO 4217 3-letter currency code"
    )
    raw_description: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Raw, unparsed bank payee description string"
    )
    transaction_time: datetime = Field(
        ...,
        description="Timestamp when the transaction occurred at the bank"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Optional upstream provider metadata"
    )


class TransactionIngestAck(BaseModel):
    """Immediate acknowledgement returned to webhook producers."""
    status: str = Field(default="accepted")
    tracking_id: str
    received_at: datetime
    deduplicated: bool = False


class TransactionResponse(BaseModel):
    """Structured transaction response delivered via REST and SSE."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    account_id: uuid.UUID
    institution_name: Optional[str] = None
    ext_transaction_id: str
    amount: float
    currency: str
    raw_description: str
    normalized_merchant: Optional[str]
    category: str
    sub_category: Optional[str]
    confidence_score: float
    is_anomaly: bool
    anomaly_reason: Optional[str]
    transaction_time: datetime
    processed_at: datetime


class AnomalyReport(BaseModel):
    """Real-time anomaly notification payload for React dashboard banner."""
    transaction_id: uuid.UUID
    merchant: Optional[str]
    amount: float
    severity: str = Field(description="LOW | MEDIUM | HIGH | CRITICAL")
    reason: str
    requires_action: bool = True
    metric_details: Optional[Dict[str, Any]] = None


class TransactionFilterParams(BaseModel):
    """Query parameters for filtering transaction ledger."""
    account_id: Optional[uuid.UUID] = None
    category: Optional[str] = None
    is_anomaly: Optional[bool] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    cursor: Optional[str] = None
    limit: int = Field(default=50, ge=1, le=100)


class CursorPaginationResponse(BaseModel):
    """Keyset-paginated response container."""
    data: List[TransactionResponse]
    next_cursor: Optional[str] = None
    has_more: bool = False
    total_count: Optional[int] = None
