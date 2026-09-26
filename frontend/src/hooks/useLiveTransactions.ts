import { useEffect, useState, useRef } from 'react';
import { Transaction, AnomalyAlert } from '../types';

export function useLiveTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Initial fetch of recent ledger records
    fetch('/api/v1/transactions?limit=25')
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          const parsedTransactions: Transaction[] = data.data.map((t: any) => ({
            ...t,
            amount: Number(t.amount) || 0,
            confidence_score: Number(t.confidence_score) || 0,
          }));
          setTransactions(parsedTransactions);
          const initialAnomalies: AnomalyAlert[] = parsedTransactions
            .filter((t: Transaction) => t.is_anomaly)
            .map((t: Transaction) => ({
              transaction_id: t.id,
              merchant: t.normalized_merchant,
              amount: Number(t.amount) || 0,
              category: t.category,
              reason: t.anomaly_reason || 'Outlier spending detected',
              severity: 'HIGH' as const,
            }));
          setAnomalies(initialAnomalies);
        }
      })
      .catch((err) => console.error('Failed to load initial transactions:', err));

    // Connect to SSE Stream
    const connectSSE = () => {
      const es = new EventSource('/api/v1/stream/events');
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
      };

      es.addEventListener('transaction_processed', (event) => {
        try {
          const rawTx = JSON.parse(event.data);
          const newTx: Transaction = {
            ...rawTx,
            amount: Number(rawTx.amount) || 0,
            confidence_score: Number(rawTx.confidence_score) || 0,
          };
          setTransactions((prev) => {
            // Deduplicate if already present
            if (prev.some((t) => t.id === newTx.id)) return prev;
            return [newTx, ...prev.slice(0, 49)];
          });
        } catch (e) {
          console.error('Error parsing transaction_processed SSE event:', e);
        }
      });

      es.addEventListener('anomaly_detected', (event) => {
        try {
          const rawAlert = JSON.parse(event.data);
          const alert: AnomalyAlert = {
            ...rawAlert,
            amount: Number(rawAlert.amount) || 0,
          };
          setAnomalies((prev) => [alert, ...prev.slice(0, 9)]);
        } catch (e) {
          console.error('Error parsing anomaly_detected SSE event:', e);
        }
      });

      es.onerror = () => {
        setIsConnected(false);
        es.close();
        // Retry connection in 4 seconds
        setTimeout(connectSSE, 4000);
      };
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const dismissAnomaly = (txId: string) => {
    setAnomalies((prev) => prev.filter((a) => a.transaction_id !== txId));
  };

  return { transactions, anomalies, isConnected, dismissAnomaly };
}
