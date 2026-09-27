"""Account Management and Aggregation Endpoints."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Account, Transaction
from src.db.session import get_db

router = APIRouter(prefix="/accounts", tags=["Accounts"])


class AccountSummaryResponse(BaseModel):
    id: uuid.UUID
    institution_name: str
    account_number_mask: str
    currency: str
    transaction_count: int
    total_spend: float


@router.get("", response_model=list[AccountSummaryResponse])
async def list_accounts(
    db: AsyncSession = Depends(get_db),
) -> list[AccountSummaryResponse]:
    """Returns all active bank accounts and cards with their transaction counts and totals."""
    # Query accounts with aggregated stats
    stmt = (
        select(
            Account,
            func.count(Transaction.id).label("tx_count"),
            func.coalesce(func.sum(Transaction.amount), 0).label("total_spend"),
        )
        .outerjoin(Transaction, Transaction.account_id == Account.id)
        .group_by(Account.id)
        .order_by(func.count(Transaction.id).desc(), Account.institution_name)
    )

    result = await db.execute(stmt)
    rows = result.all()

    accounts = []
    for acct, count, spend in rows:
        accounts.append(
            AccountSummaryResponse(
                id=acct.id,
                institution_name=acct.institution_name,
                account_number_mask=acct.account_number_mask,
                currency=acct.currency,
                transaction_count=count,
                total_spend=float(spend),
            )
        )
    return accounts


@router.post("/purge-simulated")
async def purge_simulated_data(
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Purges all simulated mock seed transactions and accounts, leaving only real transactions."""
    from sqlalchemy import delete

    # Delete simulated transactions
    del_tx_stmt = delete(Transaction).where(
        (Transaction.ext_transaction_id.like("seed_tx_%"))
        | (Transaction.ext_transaction_id.like("sim_%"))
        | (Transaction.ext_transaction_id.like("tx_%"))
        | (Transaction.ext_transaction_id.like("unique_idempotency_%"))
    )
    tx_del_result = await db.execute(del_tx_stmt)

    # Delete mock accounts that no longer have any transactions
    subq = select(Transaction.account_id).distinct()
    del_acct_stmt = delete(Account).where(
        (
            Account.institution_name.in_(
                [
                    "Chase Sapphire Reserve",
                    "Bank of America Advantage Checking",
                    "Capital One Venture X",
                    "Primary Connected Account",
                ]
            )
        )
        & (~Account.id.in_(subq))
    )
    acct_del_result = await db.execute(del_acct_stmt)

    await db.commit()

    return {
        "status": "purged",
        "transactions_removed": tx_del_result.rowcount,
        "accounts_removed": acct_del_result.rowcount,
    }
