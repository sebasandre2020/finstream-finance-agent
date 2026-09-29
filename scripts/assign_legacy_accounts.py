"""Explicit, administrator-approved assignment of legacy accounts. Dry run by default."""

import argparse
import asyncio
import uuid

from sqlalchemy import select

from src.db.models import Account, GoogleUserSession
from src.db.session import AsyncSessionLocal


async def assign(user_id, account_ids, apply=False):
    async with AsyncSessionLocal() as db:
        async with db.begin():
            user = await db.get(GoogleUserSession, user_id)
            if not user:
                raise ValueError("Google profile does not exist")
            known_users = set(
                (await db.execute(select(GoogleUserSession.id))).scalars()
            )
            accounts = (
                (
                    await db.execute(
                        select(Account)
                        .where(Account.id.in_(account_ids))
                        .with_for_update()
                    )
                )
                .scalars()
                .all()
            )
            if {a.id for a in accounts} != set(account_ids):
                raise ValueError("One or more requested accounts do not exist")
            if any(a.user_id in known_users and a.user_id != user_id for a in accounts):
                raise ValueError(
                    "An account is already owned by another Google user; no changes made"
                )
            print(
                f"{len(accounts)} explicitly selected accounts -> profile {user_id}; apply={apply}"
            )
            for account in accounts:
                print(f"{account.id}: {account.institution_name} ({account.currency})")
                if apply:
                    account.user_id = user_id


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user-id", type=uuid.UUID, required=True)
    parser.add_argument("--account-id", type=uuid.UUID, action="append", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    asyncio.run(assign(args.user_id, args.account_id, args.apply))
