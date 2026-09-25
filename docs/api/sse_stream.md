# API Specification: Server-Sent Events (SSE) Live Feed

## 1. Overview
* **Endpoint:** `GET /api/v1/stream/events`
* **Protocol:** HTTP/1.1 or HTTP/2 Streaming (Text/Event-Stream)
* **Authentication:** Bearer token query parameter `?token=<jwt>` (due to native EventSource browser limitations) or Authorization header
* **Connection Lifecycle:** Kept alive with 15-second heartbeat comments (`: ping\n\n`)

---

## 2. Event Types & Payloads

The stream multiplexes three critical event types into the React 19 UI:

### Event 1: `transaction_processed`
Fired immediately after the LangGraph agent completes categorization, entity resolution, and PostgreSQL commit.

```http
event: transaction_processed
id: evt_01J8K3P9M12ABCDEF
data: {
data:   "id": "c85d89f7-6691-4cf5-992a-3e414c770d1e",
data:   "account_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
data:   "institution_name": "Chase Sapphire",
data:   "amount": 42.50,
data:   "normalized_merchant": "Blue Bottle Coffee",
data:   "category": "Food & Dining",
data:   "confidence_score": 0.98,
data:   "is_anomaly": false,
data:   "processed_at": "2026-09-25T15:42:11.230Z"
data: }
```

### Event 2: `anomaly_detected`
Fired when statistical outlier detection flags an irregular transaction, prompting a banner or modal alert in the dashboard.

```http
event: anomaly_detected
id: evt_01J8K3Q0Z99XYZABCD
data: {
data:   "transaction_id": "e45a12d9-1123-4567-bb89-123456789abc",
data:   "merchant": "Blue Bottle Coffee",
data:   "amount": 485.00,
data:   "severity": "HIGH",
data:   "reason": "Amount exceeds 90-day category average by 11.4x",
data:   "requires_action": true
data: }
```

### Event 3: `taxonomy_updated`
Fired when the agent creates or refines a merchant entity mapping in `merchant_entities` via reflection.

```http
event: taxonomy_updated
data: {
data:   "merchant": "Blue Bottle Coffee",
data:   "assigned_category": "Food & Dining",
data:   "historical_occurrences": 12
data: }
```

---

## 3. Frontend React 19 Integration Hook

```typescript
import { useEffect, useState } from 'react';

export function useLiveTransactionFeed(token: string) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);

  useEffect(() => {
    const eventSource = new EventSource(`/api/v1/stream/events?token=${token}`);

    eventSource.addEventListener('transaction_processed', (e) => {
      const newTx = JSON.parse(e.data);
      setTransactions((prev) => [newTx, ...prev.slice(0, 49)]);
    });

    eventSource.addEventListener('anomaly_detected', (e) => {
      const alert = JSON.parse(e.data);
      setAnomalies((prev) => [alert, ...prev]);
    });

    eventSource.onerror = (err) => {
      console.error('SSE Stream Error, reconnecting in 5s...', err);
      eventSource.close();
      setTimeout(() => useLiveTransactionFeed(token), 5000);
    };

    return () => eventSource.close();
  }, [token]);

  return { transactions, anomalies };
}
```
