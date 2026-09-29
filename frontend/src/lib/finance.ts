import { Transaction } from "../types";

export function normalizeTransaction(value: unknown): Transaction {
  if (!value || typeof value !== "object")
    throw new Error("Invalid transaction");
  const tx = value as Transaction;
  const amount = Number(tx.amount);
  if (
    !tx.id ||
    !tx.account_id ||
    !Number.isFinite(amount) ||
    tx.amount == null ||
    !Number.isFinite(Date.parse(tx.transaction_time))
  )
    throw new Error("Invalid transaction");
  return {
    ...tx,
    amount,
    currency: tx.currency || "USD",
    raw_description: tx.raw_description || "",
    category: tx.category || "Uncategorized",
  };
}

export function mergeTransactions(
  current: Transaction[],
  incoming: Transaction[],
) {
  const records = new Map(current.map((tx) => [tx.id, tx]));
  incoming.forEach((tx) => records.set(tx.id, tx));
  return [...records.values()].sort(
    (a, b) =>
      Date.parse(b.transaction_time) - Date.parse(a.transaction_time) ||
      b.id.localeCompare(a.id),
  );
}

export function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function summarize(transactions: Transaction[]) {
  const cents = (amount: number) => Math.round(amount * 100);
  const spent =
    transactions.reduce((sum, tx) => sum + Math.max(0, cents(tx.amount)), 0) /
    100;
  const received =
    transactions.reduce((sum, tx) => sum + Math.max(0, -cents(tx.amount)), 0) /
    100;
  const categories = new Map<string, number>();
  transactions
    .filter((tx) => tx.amount > 0)
    .forEach((tx) =>
      categories.set(
        tx.category,
        (categories.get(tx.category) || 0) + cents(tx.amount),
      ),
    );
  return {
    spent,
    received,
    categories: [...categories]
      .map(([name, value]) => ({ name, amount: value / 100 }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export function transactionCSV(transactions: Transaction[]) {
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    const safe =
      typeof value === "string" && /^[=+@\-\t\r\n]/.test(text)
        ? `'${text}`
        : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [
    [
      "Date",
      "Merchant",
      "Account",
      "Category",
      "Amount (positive = expense)",
      "Currency",
    ],
    ...transactions.map((tx) => [
      tx.transaction_time,
      tx.normalized_merchant || tx.raw_description,
      tx.institution_name || tx.account_id,
      tx.category,
      tx.amount,
      tx.currency,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
