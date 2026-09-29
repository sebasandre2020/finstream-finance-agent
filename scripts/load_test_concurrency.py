"""Concurrency and Load Testing for Technical Demo Deployment.

Simulates 5 concurrent users interacting with the deployment over HTTPS.
Verifies response codes, latency p50/p95/p99, error rates, and throughput.
"""

import asyncio
import os
import time

import httpx

TARGET_URL = os.getenv(
    "TARGET_URL", "https://creations-dress-efficiency-instant.trycloudflare.com"
)
CONCURRENT_USERS = 5
REQUESTS_PER_USER = 20

ENDPOINTS = [
    "/",
    "/docs",
    "/api/v1/auth/google/status",
]


async def simulate_user(user_id: int, client: httpx.AsyncClient) -> list[dict]:
    results = []
    for i in range(REQUESTS_PER_USER):
        endpoint = ENDPOINTS[i % len(ENDPOINTS)]
        start = time.perf_counter()
        try:
            resp = await client.get(f"{TARGET_URL}{endpoint}", timeout=10.0)
            latency = (time.perf_counter() - start) * 1000
            results.append(
                {
                    "user_id": user_id,
                    "endpoint": endpoint,
                    "status": resp.status_code,
                    "latency_ms": latency,
                    "ok": resp.status_code == 200,
                }
            )
        except Exception as e:
            latency = (time.perf_counter() - start) * 1000
            results.append(
                {
                    "user_id": user_id,
                    "endpoint": endpoint,
                    "status": 0,
                    "error": str(e),
                    "latency_ms": latency,
                    "ok": False,
                }
            )
        # Simulate realistic user think time between 50ms and 150ms
        await asyncio.sleep(0.08)
    return results


async def main():
    print(f"🚀 Starting 5-user concurrency load test against {TARGET_URL}...")
    start_total = time.perf_counter()

    async with httpx.AsyncClient(verify=True) as client:
        tasks = [
            simulate_user(user_id=u, client=client) for u in range(CONCURRENT_USERS)
        ]
        all_results = await asyncio.gather(*tasks)

    total_time = time.perf_counter() - start_total
    flattened = [res for user_res in all_results for res in user_res]

    total_requests = len(flattened)
    successful = sum(1 for r in flattened if r["ok"])
    failed = total_requests - successful
    latencies = sorted(r["latency_ms"] for r in flattened if r["ok"])

    p50 = latencies[int(len(latencies) * 0.50)] if latencies else 0
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0
    p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0
    avg_lat = sum(latencies) / len(latencies) if latencies else 0
    rps = total_requests / total_time

    print("\n" + "=" * 50)
    print("📊 5-USER CONCURRENCY TEST REPORT")
    print("=" * 50)
    print(f"Total Requests Processed: {total_requests}")
    print(
        f"Successful (200 OK):      {successful} ({successful / total_requests * 100:.1f}%)"
    )
    print(f"Failed / Errors:          {failed}")
    print(f"Throughput:               {rps:.1f} req/sec")
    print(f"Average Latency:          {avg_lat:.1f} ms")
    print(f"p50 Latency:              {p50:.1f} ms")
    print(f"p95 Latency:              {p95:.1f} ms")
    print(f"p99 Latency:              {p99:.1f} ms")
    print("=" * 50)

    assert failed == 0, f"Expected 0 failures, got {failed}"
    print("✅ All 5 concurrent users served with 100% success rate!\n")


if __name__ == "__main__":
    asyncio.run(main())
