"""Transaction Ledger and Historical Query Endpoints."""

import base64
import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.session import require_user
from src.db.models import Account, GoogleUserSession, Transaction
from src.db.session import get_db
from src.schemas.transaction import CursorPaginationResponse, TransactionResponse

router = APIRouter(prefix="/transactions", tags=["Transactions Ledger"])


def encode_cursor(dt: datetime, tx_id: uuid.UUID) -> str:
    payload = {"t": dt.isoformat(), "id": str(tx_id)}
    return base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")


def decode_cursor(cursor_str: str) -> tuple[datetime, uuid.UUID]:
    try:
        raw_bytes = base64.urlsafe_b64decode(cursor_str.encode("utf-8"))
        data = json.loads(raw_bytes.decode("utf-8"))
        return datetime.fromisoformat(data["t"]), uuid.UUID(data["id"])
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed pagination cursor.",
        ) from err


@router.get(
    "",
    response_model=CursorPaginationResponse,
    summary="Query transaction ledger with cursor pagination",
    description="Returns filtered multi-account transaction history ordered chronologically.",
)
async def list_transactions(
    account_id: uuid.UUID | None = Query(None, description="Filter by account UUID"),
    category: str | None = Query(None, description="Filter by category"),
    is_anomaly: bool | None = Query(None, description="Filter by anomaly status"),
    cursor: str | None = Query(None, description="Pagination cursor"),
    limit: int = Query(50, ge=1, le=100, description="Page limit"),
    db: AsyncSession = Depends(get_db),
    user: GoogleUserSession = Depends(require_user),
) -> CursorPaginationResponse:
    filters = [Transaction.account.has(Account.user_id == user.id)]
    if account_id:
        filters.append(Transaction.account_id == account_id)
    if category:
        filters.append(Transaction.category == category)
    if is_anomaly is not None:
        filters.append(Transaction.is_anomaly == is_anomaly)

    if cursor:
        cursor_dt, cursor_id = decode_cursor(cursor)
        filters.append(
            or_(
                Transaction.transaction_time < cursor_dt,
                and_(
                    Transaction.transaction_time == cursor_dt,
                    Transaction.id < cursor_id,
                ),
            )
        )

    # Base query joined with Account
    stmt = (
        select(Transaction)
        .options(selectinload(Transaction.account))
        .where(and_(*filters))
        .order_by(desc(Transaction.transaction_time), desc(Transaction.id))
        .limit(limit + 1)
    )

    result = await db.execute(stmt)
    records = result.scalars().all()

    has_more = len(records) > limit
    page_records = records[:limit]

    items = []
    for tx in page_records:
        items.append(
            TransactionResponse(
                id=tx.id,
                account_id=tx.account_id,
                institution_name=tx.account.institution_name if tx.account else None,
                ext_transaction_id=tx.ext_transaction_id,
                amount=tx.amount,
                currency=tx.account.currency if tx.account else "USD",
                raw_description=tx.raw_description,
                normalized_merchant=tx.normalized_merchant,
                category=tx.category,
                sub_category=tx.sub_category,
                confidence_score=tx.confidence_score,
                is_anomaly=tx.is_anomaly,
                anomaly_reason=tx.anomaly_reason,
                transaction_time=tx.transaction_time,
                processed_at=tx.processed_at,
            )
        )

    next_cursor = None
    if has_more and page_records:
        last_tx = page_records[-1]
        next_cursor = encode_cursor(last_tx.transaction_time, last_tx.id)

    return CursorPaginationResponse(
        data=items, next_cursor=next_cursor, has_more=has_more
    )


@router.get(
    "/{transaction_id}",
    response_model=TransactionResponse,
    summary="Get single transaction detail",
    description="Retrieves a specific categorized transaction by ID.",
)
async def get_transaction(
    transaction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: GoogleUserSession = Depends(require_user),
) -> TransactionResponse:
    stmt = (
        select(Transaction)
        .options(selectinload(Transaction.account))
        .where(
            Transaction.id == transaction_id,
            Transaction.account.has(Account.user_id == user.id),
        )
    )
    result = await db.execute(stmt)
    tx = result.scalar_one_or_none()

    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction {transaction_id} not found.",
        )

    return TransactionResponse(
        id=tx.id,
        account_id=tx.account_id,
        institution_name=tx.account.institution_name if tx.account else None,
        ext_transaction_id=tx.ext_transaction_id,
        amount=tx.amount,
        currency=tx.account.currency if tx.account else "USD",
        raw_description=tx.raw_description,
        normalized_merchant=tx.normalized_merchant,
        category=tx.category,
        sub_category=tx.sub_category,
        confidence_score=tx.confidence_score,
        is_anomaly=tx.is_anomaly,
        anomaly_reason=tx.anomaly_reason,
        transaction_time=tx.transaction_time,
        processed_at=tx.processed_at,
    )
