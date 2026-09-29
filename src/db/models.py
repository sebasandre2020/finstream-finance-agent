"""SQLAlchemy ORM Database Models with pgvector Integration."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    String,
    Numeric,
    Float,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Index,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from src.db.base import Base


class Account(Base):
    """Registered banking or financial institution account."""

    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    institution_name: Mapped[str] = mapped_column(String(100), nullable=False)
    account_number_mask: Mapped[str] = mapped_column(String(10), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction", back_populates="account", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Account(id={self.id}, institution='{self.institution_name}', mask='{self.account_number_mask}')>"


class MerchantEntity(Base):
    """Normalized merchant reference catalog with pgvector embedding for fast semantic lookup."""

    __tablename__ = "merchant_entities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    normalized_name: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    default_category: Mapped[str] = mapped_column(String(100), nullable=False)
    default_subcategory: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )

    # 1536-dimensional vector for cosine similarity matching
    embedding: Mapped[List[float]] = mapped_column(Vector(1536), nullable=False)

    occurrence_count: Mapped[int] = mapped_column(default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<MerchantEntity(id={self.id}, name='{self.normalized_name}', category='{self.default_category}')>"


class Transaction(Base):
    """Categorized and reconciled transaction record."""

    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    ext_transaction_id: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    raw_description: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_merchant: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    sub_category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    is_anomaly: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    anomaly_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    transaction_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    account: Mapped["Account"] = relationship("Account", back_populates="transactions")

    # Table constraints and indexes
    __table_args__ = (
        UniqueConstraint("account_id", "ext_transaction_id", name="uq_account_ext_tx"),
        Index("idx_transactions_account_time", "account_id", "transaction_time"),
        Index("idx_transactions_category", "category"),
        Index("idx_transactions_anomaly", "is_anomaly"),
    )

    def __repr__(self) -> str:
        return f"<Transaction(id={self.id}, amount={self.amount}, merchant='{self.normalized_merchant}', category='{self.category}')>"


class GoogleUserSession(Base):
    """Stores authenticated Google user profile, tokens, and 7-day session state."""

    __tablename__ = "google_user_sessions"
    google_subject: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=True)
    picture: Mapped[str | None] = mapped_column(String(500), nullable=True)
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    session_token: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    session_expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<GoogleUserSession(email='{self.email}', session_expires='{self.session_expires_at}')>"
