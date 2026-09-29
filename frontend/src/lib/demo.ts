import { Transaction } from "../types";

export function demoTransactions(): Transaction[] {
  const now = new Date();
  const items: [string, string, number, string, number, number][] = [
    ["Whole Foods Market", "Groceries", 86.42, "Everyday checking", 0, 0],
    ["Blue Bottle Coffee", "Food & Drink", 6.5, "Everyday checking", 0, 0],
    ["Monthly paycheck", "Income", -3250, "Everyday checking", 1, 0],
    ["Spotify", "Entertainment", 11.99, "Everyday card", 2, 0],
    ["Northside Bistro", "Food & Drink", 148.0, "Everyday card", 3, 1],
    ["Trader Joe’s", "Groceries", 64.8, "Everyday checking", 4, 0],
    ["City Transit", "Transport", 32, "Everyday card", 5, 0],
    ["Apartment rent", "Housing", 1250, "Everyday checking", 6, 0],
    ["Uniqlo", "Shopping", 79.9, "Everyday card", 7, 0],
    ["Electric company", "Utilities", 68.4, "Everyday checking", 8, 0],
    ["Bookshop", "Shopping", 24, "Everyday card", 9, 0],
    ["Store refund", "Shopping", -29.9, "Everyday card", 10, 0],
  ];
  return items.map(([merchant, category, amount, bank, days, anomaly], i) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      Math.max(1, now.getDate() - days),
      10,
      30 - i,
    );
    return {
      id: `demo-${i}`,
      account_id: bank,
      institution_name: bank,
      ext_transaction_id: `sample-${i}`,
      amount,
      currency: "USD",
      raw_description: merchant.toUpperCase(),
      normalized_merchant: merchant,
      category,
      confidence_score: 0.98,
      is_anomaly: !!anomaly,
      anomaly_reason: anomaly
        ? "This meal cost more than your usual restaurant visits. Take a moment to check it looks right."
        : undefined,
      transaction_time: date.toISOString(),
      processed_at: date.toISOString(),
    };
  });
}
