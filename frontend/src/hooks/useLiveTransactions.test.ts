import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLiveTransactions } from "./useLiveTransactions";
import { demoTransactions } from "../lib/demo";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  listeners = new Map<string, (event: { data: string }) => void>();
  close = vi.fn();
  constructor() {
    FakeEventSource.instances.push(this);
  }
  addEventListener(name: string, callback: (event: { data: string }) => void) {
    this.listeners.set(name, callback);
  }
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  FakeEventSource.instances = [];
});
const page = (
  data: unknown[],
  has_more = false,
  next_cursor: string | null = null,
) => ({ ok: true, json: async () => ({ data, has_more, next_cursor }) });
describe("activity synchronization", () => {
  it("preserves a live arrival while the initial fetch is still pending, then closes on unmount", async () => {
    let resolve!: (value: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      ),
    );
    vi.stubGlobal("EventSource", FakeEventSource);
    const { result, unmount } = renderHook(() => useLiveTransactions());
    const es = FakeEventSource.instances[0];
    const records = demoTransactions();
    act(() =>
      es.listeners.get("transaction_processed")!({
        data: JSON.stringify(records[0]),
      }),
    );
    await act(async () => resolve(page([records[1]])));
    await waitFor(() => expect(result.current.transactions).toHaveLength(2));
    unmount();
    expect(es.close).toHaveBeenCalledOnce();
  });
  it("does not reopen exhausted pagination after refresh", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(page([demoTransactions()[0]], true, "page2"))
      .mockResolvedValueOnce(page([demoTransactions()[1]]))
      .mockResolvedValue(page([demoTransactions()[0]], true, "page2"));
    vi.stubGlobal("fetch", fetcher);
    vi.stubGlobal("EventSource", FakeEventSource);
    const { result } = renderHook(() => useLiveTransactions());
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.hasMore).toBe(false);
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.hasMore).toBe(false);
    expect(result.current.transactions).toHaveLength(2);
  });
  it("exposes server errors and supports retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValue(page(demoTransactions())),
    );
    vi.stubGlobal("EventSource", FakeEventSource);
    const { result } = renderHook(() => useLiveTransactions());
    await waitFor(() =>
      expect(result.current.error).toContain("couldn’t load"),
    );
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBe("");
    expect(result.current.transactions).toHaveLength(12);
  });
});
