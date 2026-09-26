"""Real-Time Statistical Anomaly and Outlier Detection Engine."""

import logging
import uuid
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("AnomalyDetectionEngine")


class AnomalyDetectionEngine:
    """Evaluates transaction spend against user's 90-day category history."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def evaluate_transaction(
        self, account_id: uuid.UUID, category: str, amount: Decimal
    ) -> tuple[bool, str | None]:
        """
        Calculates rolling modified Z-score using Median Absolute Deviation (MAD).
        Returns: (is_anomaly, anomaly_reason)
        """
        # Negative amounts are refunds / deposits; skip debit anomaly detection
        if amount <= 0:
            return False, None

        float_amount = float(amount)

        # 1. Fetch 90-day amounts for this account and category
        sql = text("""
            SELECT amount
            FROM transactions
            WHERE account_id = :account_id
              AND category = :category
              AND transaction_time >= NOW() - INTERVAL '90 days'
            ORDER BY amount ASC;
        """)

        result = await self.session.execute(
            sql, {"account_id": account_id, "category": category}
        )
        rows = result.scalars().all()
        amounts = [float(a) for a in rows]

        # 2. Heuristic check if cold start / low sample size
        if len(amounts) < 5:
            # Fallback heuristic for new accounts or rare categories
            if float_amount > 500.0 and category in [
                "Food & Dining",
                "Entertainment & Leisure",
            ]:
                reason = f"High spend alert: ${float_amount:.2f} in {category} exceeds $500 baseline threshold (limited history)."
                return True, reason
            return False, None

        # 3. Calculate Median and MAD (Median Absolute Deviation)
        n = len(amounts)
        median = (
            amounts[n // 2]
            if n % 2 != 0
            else (amounts[n // 2 - 1] + amounts[n // 2]) / 2.0
        )

        deviations = sorted([abs(x - median) for x in amounts])
        mad = (
            deviations[n // 2]
            if n % 2 != 0
            else (deviations[n // 2 - 1] + deviations[n // 2]) / 2.0
        )

        # Prevent division by zero if all past transactions had identical amounts
        mad = max(mad, 1.0)

        # Modified Z-score formula (Boris Iglewicz and David Hoaglin standard)
        modified_z = (0.6745 * abs(float_amount - median)) / mad

        logger.debug(
            "Anomaly evaluation for %s: amount=%.2f, median=%.2f, MAD=%.2f, Z=%.2f",
            category,
            float_amount,
            median,
            mad,
            modified_z,
        )

        # 4. Outlier threshold
        if modified_z > 3.5 and float_amount > median * 2.0:
            multiplier = float_amount / median if median > 0 else 0
            reason = (
                f"Spending Anomaly: ${float_amount:.2f} is {multiplier:.1f}x your 90-day median (${median:.2f}) "
                f"for '{category}' (Modified Z-Score: {modified_z:.1f})."
            )
            return True, reason

        return False, None
