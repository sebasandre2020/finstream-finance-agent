import { useEffect, useState, useRef, useCallback } from "react";
import { Transaction } from "../types";
import { mergeTransactions, normalizeTransaction } from "../lib/finance";

export function useLiveTransactions(enabled = true) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const cursorRef = useRef<string | null>(null);
  const initialized = useRef(false);

  const fetchPage = useCallback(async (next?: string) => {
    if (busy.current) return;
    busy.current = true;
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/transactions?limit=100${next ? `&cursor=${encodeURIComponent(next)}` : ""}`,
        { signal: request.signal },
      );
      if (response.status === 401) {
        setTransactions([]);
        window.dispatchEvent(new Event("finstream:unauthorized"));
        return;
      }
      if (!response.ok) throw new Error("Unable to load activity");
      const data = await response.json();
      if (!Array.isArray(data.data)) throw new Error("Unexpected response");
      const records = data.data.map(normalizeTransaction);
      if (!request.signal.aborted) {
        setTransactions((previous) => mergeTransactions(records, previous));
        if (next || !initialized.current) {
          cursorRef.current = data.has_more ? data.next_cursor : null;
          setCursor(cursorRef.current);
          initialized.current = true;
        }
      }
    } catch {
      if (!request.signal.aborted)
        setError(
          "We couldn’t load your activity. Check your connection and try again.",
        );
    } finally {
      if (controller.current === request) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void fetchPage();
    const es = new EventSource("/api/v1/stream/events");
    es.onopen = () => {
      setIsConnected(true);
      void fetchPage();
    };
    es.onerror = () => setIsConnected(false);
    es.addEventListener("transaction_processed", (event) => {
      try {
        const tx = normalizeTransaction(JSON.parse(event.data));
        setTransactions((previous) => mergeTransactions(previous, [tx]));
      } catch {
        setError("An activity update could not be read. Refresh to try again.");
      }
    });
    // Poll as a fallback: the worker and API currently have separate in-memory broadcasters.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchPage();
    }, 30000);
    return () => {
      es.close();
      window.clearInterval(timer);
      controller.current?.abort();
      controller.current = null;
      busy.current = false;
      setIsConnected(false);
    };
  }, [enabled, fetchPage]);

  return {
    transactions,
    isConnected,
    loading,
    error,
    hasMore: !!cursor,
    refresh: () => fetchPage(),
    loadMore: () => cursor && fetchPage(cursor),
  };
}
