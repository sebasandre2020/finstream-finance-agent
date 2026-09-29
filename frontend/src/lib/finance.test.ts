import { describe, expect, it } from "vitest";
import { demoTransactions } from "./demo";
import {
  mergeTransactions,
  normalizeTransaction,
  summarize,
  transactionCSV,
} from "./finance";

describe("financial data handling", () => {
  const base = demoTransactions()[0];
  it("accepts the decimal strings returned by the API", () => {
    expect(normalizeTransaction({ ...base, amount: "86.42" }).amount).toBe(
      86.42,
    );
    expect(() => normalizeTransaction({ ...base, amount: "bad" })).toThrow();
    expect(() => normalizeTransaction({ ...base, amount: null })).toThrow();
  });
  it("keeps expenses separate from deposits and refunds without floating point drift", () => {
    const result = summarize(
      [0.1, 0.2, -1.01].map((amount, i) => ({
        ...base,
        id: String(i),
        amount,
      })),
    );
    expect(result.spent).toBe(0.3);
    expect(result.received).toBe(1.01);
    expect(result.categories[0].amount).toBe(0.3);
  });
  it("deduplicates overlapping history and live events while keeping newest first", () => {
    const older = {
      ...base,
      id: "old",
      transaction_time: "2020-01-01T00:00:00Z",
    };
    const result = mergeTransactions([older, base], [{ ...base, amount: 9 }]);
    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe(9);
    expect(result[1].id).toBe("old");
  });
  it("escapes CSV fields and prevents merchant formula injection", () => {
    const csv = transactionCSV([
      { ...base, normalized_merchant: '=HYPERLINK("bad")', amount: -3 },
    ]);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"-3"');
    expect(csv).toContain('"USD"');
  });
});
