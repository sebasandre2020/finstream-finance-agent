"""Pydantic schemas for email transaction parsing and synchronization."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class EmailParseRequest(BaseModel):
    """Request payload to parse raw email content."""

    sender: str | None = Field(
        default=None, description="Sender email address, e.g. notificaciones@bcp.com.pe"
    )
    subject: str | None = Field(
        default=None, description="Email subject line, e.g. Constancia de Operación"
    )
    body: str = Field(
        ..., min_length=5, description="Raw plain text or HTML email body"
    )
    account_id: uuid.UUID | None = Field(
        default=None, description="Target account UUID to associate transactions with"
    )


class EmailTransactionResult(BaseModel):
    """Normalized transaction extracted from an email."""

    is_transaction: bool = Field(
        ..., description="True if email represents an actual financial transaction"
    )
    merchant: str | None = Field(
        default=None, description="Extracted payee or merchant name"
    )
    amount: float | None = Field(default=None, description="Transaction amount value")
    currency: str = Field(default="PEN", description="Currency code (e.g. PEN, USD)")
    transaction_time: datetime | None = Field(
        default=None, description="Extracted transaction timestamp"
    )
    card_or_account: str | None = Field(
        default=None, description="Masked card or account number if found"
    )
    operation_type: str = Field(
        default="DEBIT", description="DEBIT, CREDIT, or TRANSFER"
    )
    parser_used: str = Field(
        default="none",
        description="Parser strategy: regex_bcp_card | regex_yape | regex_bcp_transfer | llm_fallback | none",
    )
    confidence: float = Field(
        default=0.0, description="Extraction confidence score from 0.0 to 1.0"
    )
    raw_description: str | None = Field(
        default=None, description="Synthesized payee description for categorization"
    )
    ext_transaction_id: str | None = Field(
        default=None, description="Unique external transaction ID derived from email"
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional context extracted from email"
    )


class EmailIngestResponse(BaseModel):
    """Response returned after parsing and ingesting an email transaction."""

    status: str = Field(
        ...,
        description="'ingested' | 'duplicate_ignored' | 'not_a_transaction' | 'error'",
    )
    tracking_id: str | None = None
    transaction: EmailTransactionResult | None = None
    message: str | None = None


class GmailSyncRequest(BaseModel):
    """Request to initiate a live Gmail IMAP inbox sync for BCP/Yape transactions."""

    email_address: str = Field(
        ..., description="User's Gmail address (e.g. usuario@gmail.com)"
    )
    app_password: str = Field(
        ...,
        min_length=16,
        max_length=32,
        description="Google App Password (16 characters, generated in Google Account Security)",
    )
    account_id: uuid.UUID | None = Field(
        default=None, description="Target account UUID to link transactions to"
    )
    max_emails: int = Field(
        default=10, ge=1, le=50, description="Maximum recent emails to inspect"
    )
    unread_only: bool = Field(
        default=True, description="Only search unread emails if True"
    )


class GmailSyncResponse(BaseModel):
    """Summary result of a live Gmail inbox sync."""

    connected: bool
    total_inspected: int
    transactions_found: int
    ingested_count: int
    duplicates_count: int
    results: list[EmailTransactionResult]
    error: str | None = None
