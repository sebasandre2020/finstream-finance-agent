"""Banking Webhook Traffic Simulator and Load Tester.

Fires HMAC-SHA256 signed mock banking webhooks to the local FastAPI ingestion endpoint.
Usage:
    python scripts/simulate_bank_feed.py --count 10 --interval 1.0
"""

import argparse
import asyncio
import hashlib
import hmac
import json
import os
import random
import uuid
from datetime import UTC, datetime

import httpx

API_URL = "http://localhost:8000/api/v1/webhooks/transactions"
SECRET_KEY = os.getenv("WEBHOOK_SIGNING_SECRET", "local-test-hmac-secret-12345")

TEST_ACCOUNTS = [
    "b0000000-0000-0000-0000-000000000001",
    "b0000000-0000-0000-0000-000000000002",
    "b0000000-0000-0000-0000-000000000003",
]

TEST_PAYEES = [
    ("SQ *BLUE BOTTLE COFFEE HAYES 94102 US", 5.25),
    ("STARBUCKS STORE #0482 SEATTLE WA", 6.80),
    ("UBER *TRIP 9821 PENDING", 24.50),
    ("SHELL OIL 57442 SAN JOSE CA", 48.00),
    ("WHOLEFDS MKT #102 AUSTIN TX", 84.12),
    ("NETFLIX.COM DIGITAL SUBSCRIPTION", 19.99),
    ("AMZN MKTP US*192847291 SEATTLE", 39.95),
    ("CHEVRON 00928 SAN FRANCISCO", 52.00),
    # Explicit Anomaly Test Case: Huge coffee charge
    ("BLUE BOTTLE COFFEE WHOLESALE CATERING", 485.00),
]


def sign_payload(body_bytes: bytes, secret: str) -> str:
    return hmac.new(
        key=secret.encode("utf-8"), msg=body_bytes, digestmod=hashlib.sha256
    ).hexdigest()


async def send_mock_webhook(
    client: httpx.AsyncClient, account_id: str, desc: str, amount: float
):
    tx_id = f"sim_tx_{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(UTC).isoformat()

    payload = {
        "account_id": account_id,
        "ext_transaction_id": tx_id,
        "amount": amount,
        "currency": "USD",
        "raw_description": desc,
        "transaction_time": now_iso,
        "metadata": {"simulation": True},
    }

    body_bytes = json.dumps(payload).encode("utf-8")
    sig = sign_payload(body_bytes, SECRET_KEY)

    headers = {
        "Content-Type": "application/json",
        "X-Signature-SHA256": sig,
        "X-Timestamp": now_iso,
        "X-Bank-Provider": "plaid_simulator",
    }

    try:
        resp = await client.post(API_URL, content=body_bytes, headers=headers)
        print(
            f"[{resp.status_code}] Tx: {tx_id} | ${amount:6.2f} | {desc[:35]}... -> {resp.json().get('status')}"
        )
    except Exception as e:
        print(f"❌ Failed to deliver webhook: {e}")


async def main():
    parser = argparse.ArgumentParser(description="Simulate bank transaction stream.")
    parser.add_argument(
        "--count", type=int, default=10, help="Number of transactions to send"
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=0.8,
        help="Delay between transactions in seconds",
    )
    args = parser.parse_args()

    print(f"🚀 Firing {args.count} simulated banking webhooks to {API_URL}...")
    async with httpx.AsyncClient(timeout=5.0) as client:
        for _ in range(args.count):
            acct = random.choice(TEST_ACCOUNTS)
            desc, amount = random.choice(TEST_PAYEES)
            await send_mock_webhook(client, acct, desc, amount)
            await asyncio.sleep(args.interval)
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
