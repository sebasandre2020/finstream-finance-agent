# API Specification: Transactions Query & Ledger

## 1. Overview
* **Endpoint:** `GET /api/v1/transactions`
* **Protocol:** HTTP/1.1 or HTTP/2
* **Authentication:** Bearer JWT Token (`Authorization: Bearer <jwt>`)
* **Latency SLA:** `p95 < 45ms`, `p99 < 80ms` (Indexed PostgreSQL read replica query)

---

## 2. Query Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `account_id` | UUID | No | `null` | Filter by specific bank account. If omitted, returns across all user accounts. |
| `category` | String | No | `null` | Filter by unified taxonomy (e.g., `Food & Dining`, `Utilities`, `Travel`). |
| `is_anomaly` | Boolean | No | `null` | Filter specifically for transactions flagged as anomalous. |
| `start_date` | Date | No | `null` | ISO-8601 start date (`YYYY-MM-DD`). |
| `end_date` | Date | No | `null` | ISO-8601 end date (`YYYY-MM-DD`). |
| `cursor` | String | No | `null` | Opaque base64 cursor for high-performance keyset pagination. |
| `limit` | Integer | No | `50` | Maximum items to return (min: 1, max: 100). |

---

## 3. Response Schema (200 OK)

```json
{
  "data": [
    {
      "id": "c85d89f7-6691-4cf5-992a-3e414c770d1e",
      "account_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "institution_name": "Chase Sapphire Preferred",
      "ext_transaction_id": "tx_plaid_9942a8b9",
      "amount": 42.50,
      "currency": "USD",
      "raw_description": "SQ *BLUE BOTTLE COFFEE HAYES VALLEY CA 94102 US",
      "normalized_merchant": "Blue Bottle Coffee",
      "category": "Food & Dining",
      "sub_category": "Coffee Shops",
      "confidence_score": 0.98,
      "is_anomaly": false,
      "anomaly_reason": null,
      "transaction_time": "2026-09-25T15:42:10Z",
      "processed_at": "2026-09-25T15:42:11.230Z"
    },
    {
      "id": "e45a12d9-1123-4567-bb89-123456789abc",
      "account_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "institution_name": "Chase Sapphire Preferred",
      "ext_transaction_id": "tx_plaid_9942a8c0",
      "amount": 485.00,
      "currency": "USD",
      "raw_description": "BLUE BOTTLE COFFEE WHOLESALE CA",
      "normalized_merchant": "Blue Bottle Coffee",
      "category": "Food & Dining",
      "sub_category": "Coffee Shops",
      "confidence_score": 0.94,
      "is_anomaly": true,
      "anomaly_reason": "Amount ($485.00) is 11.4x standard deviation above user 90-day average for Coffee Shops ($4.25).",
      "transaction_time": "2026-09-25T16:10:00Z",
      "processed_at": "2026-09-25T16:10:01.050Z"
    }
  ],
  "pagination": {
    "next_cursor": "ZXlKaGJHY2lPaUpTVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5",
    "has_more": true,
    "total_count": 142
  }
}
```

---

## 4. Error Responses

| Status Code | Code String | Meaning |
| :--- | :--- | :--- |
| `401 Unauthorized` | `AUTH_TOKEN_EXPIRED` | JWT bearer token has expired or is invalid. |
| `403 Forbidden` | `ACCESS_DENIED` | Attempted to query an `account_id` not belonging to the authenticated user. |
| `400 Bad Request` | `INVALID_CURSOR` | Cursor string could not be decoded. |
