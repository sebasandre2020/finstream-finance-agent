"""Database Seeding Script for Multi-Account Finance Agent.

Populates initial accounts, historical merchant vectors, and baseline transactions.
Usage:
    python scripts/seed_db.py
"""

import asyncio
import math
import random
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select

from src.core.taxonomy import PrimaryCategory
from src.db.models import Account, MerchantEntity, Transaction
from src.db.session import AsyncSessionLocal


def generate_deterministic_embedding(seed_str: str, dim: int = 1536) -> list[float]:
    """Generates a normalized 1536-dimensional vector deterministically from text."""
    rng = random.Random(seed_str)
    raw_vec = [rng.gauss(0, 1) for _ in range(dim)]
    norm = math.sqrt(sum(x * x for x in raw_vec))
    return [x / norm for x in raw_vec]


# Canonical seed merchants
SEED_MERCHANTS = [
    ("Blue Bottle Coffee", PrimaryCategory.FOOD_AND_DINING, "Coffee Shops"),
    ("Starbucks", PrimaryCategory.FOOD_AND_DINING, "Coffee Shops"),
    ("Philz Coffee", PrimaryCategory.FOOD_AND_DINING, "Coffee Shops"),
    ("Whole Foods Market", PrimaryCategory.FOOD_AND_DINING, "Groceries & Supermarkets"),
    ("Trader Joe's", PrimaryCategory.FOOD_AND_DINING, "Groceries & Supermarkets"),
    ("Safeway", PrimaryCategory.FOOD_AND_DINING, "Groceries & Supermarkets"),
    ("Uber", PrimaryCategory.TRANSPORTATION, "Rideshare & Taxis"),
    ("Lyft", PrimaryCategory.TRANSPORTATION, "Rideshare & Taxis"),
    ("Shell Oil", PrimaryCategory.TRANSPORTATION, "Gas & Fuel"),
    ("Chevron", PrimaryCategory.TRANSPORTATION, "Gas & Fuel"),
    ("Netflix", PrimaryCategory.ENTERTAINMENT_AND_LEISURE, "Streaming Subscriptions"),
    ("Spotify", PrimaryCategory.ENTERTAINMENT_AND_LEISURE, "Streaming Subscriptions"),
    ("Amazon.com", PrimaryCategory.SHOPPING_AND_RETAIL, "General Merchandise"),
    ("Apple Store", PrimaryCategory.SHOPPING_AND_RETAIL, "Electronics & Software"),
    ("Pacific Gas & Electric", PrimaryCategory.UTILITIES_AND_BILLS, "Electric & Gas"),
    ("AT&T Mobility", PrimaryCategory.UTILITIES_AND_BILLS, "Mobile Phone"),
    ("Equinox Gym", PrimaryCategory.HEALTHCARE_AND_WELLNESS, "Gym & Fitness"),
    ("CVS Pharmacy", PrimaryCategory.HEALTHCARE_AND_WELLNESS, "Pharmacies & Medicine"),
]


async def seed():
    print("🌱 Starting database seeding...")
    async with AsyncSessionLocal() as session:
        # 1. Check if already seeded
        result = await session.execute(select(Account))
        existing_accounts = result.scalars().all()
        if existing_accounts:
            print(
                f"⚠️  Database already contains {len(existing_accounts)} accounts. Skipping account generation."
            )
            return

        demo_user_id = uuid.UUID("a0000000-0000-0000-0000-000000000001")

        # 2. Create Accounts
        accounts = [
            Account(
                id=uuid.UUID("b0000000-0000-0000-0000-000000000001"),
                user_id=demo_user_id,
                institution_name="Chase Sapphire Reserve",
                account_number_mask="*4821",
                currency="USD",
            ),
            Account(
                id=uuid.UUID("b0000000-0000-0000-0000-000000000002"),
                user_id=demo_user_id,
                institution_name="Bank of America Advantage Checking",
                account_number_mask="*9104",
                currency="USD",
            ),
            Account(
                id=uuid.UUID("b0000000-0000-0000-0000-000000000003"),
                user_id=demo_user_id,
                institution_name="Capital One Venture X",
                account_number_mask="*1288",
                currency="USD",
            ),
        ]
        session.add_all(accounts)
        await session.flush()
        print(f"✅ Created {len(accounts)} multi-bank accounts.")

        # 3. Create Merchant Vector Entities
        merchant_objs = []
        for name, cat, subcat in SEED_MERCHANTS:
            embedding = generate_deterministic_embedding(name)
            merchant_objs.append(
                MerchantEntity(
                    id=uuid.uuid4(),
                    normalized_name=name,
                    default_category=cat.value,
                    default_subcategory=subcat,
                    embedding=embedding,
                    occurrence_count=random.randint(10, 50),
                )
            )
        session.add_all(merchant_objs)
        await session.flush()
        print(
            f"✅ Seeded {len(merchant_objs)} normalized merchant entities with 1536-d vectors."
        )

        # 4. Generate 60 days of historical baseline transactions
        now = datetime.now(UTC)
        historical_txs = []
        for i in range(75):
            acct = random.choice(accounts)
            merch_name, cat, subcat = random.choice(SEED_MERCHANTS)

            # Baseline realistic spending ranges
            if subcat == "Coffee Shops":
                amount = round(Decimal(random.uniform(4.50, 7.50)), 2)
            elif subcat == "Groceries & Supermarkets":
                amount = round(Decimal(random.uniform(45.00, 140.00)), 2)
            elif subcat == "Gas & Fuel":
                amount = round(Decimal(random.uniform(35.00, 65.00)), 2)
            elif subcat == "Streaming Subscriptions":
                amount = round(Decimal(random.choice([15.49, 19.99, 10.99])), 2)
            else:
                amount = round(Decimal(random.uniform(15.00, 95.00)), 2)

            days_ago = random.randint(1, 60)
            tx_time = now - timedelta(days=days_ago, minutes=random.randint(0, 1440))

            historical_txs.append(
                Transaction(
                    id=uuid.uuid4(),
                    account_id=acct.id,
                    ext_transaction_id=f"seed_tx_{i:04d}",
                    amount=amount,
                    raw_description=f"SQ *{merch_name.upper()} STORE #{random.randint(100, 999)}",
                    normalized_merchant=merch_name,
                    category=cat.value,
                    sub_category=subcat,
                    confidence_score=0.98,
                    is_anomaly=False,
                    anomaly_reason=None,
                    transaction_time=tx_time,
                    processed_at=tx_time + timedelta(seconds=1),
                )
            )

        session.add_all(historical_txs)
        await session.commit()
        print(
            f"✅ Seeded {len(historical_txs)} baseline historical transactions across accounts."
        )
        print("🎉 Database seeding complete!")


if __name__ == "__main__":
    asyncio.run(seed())
