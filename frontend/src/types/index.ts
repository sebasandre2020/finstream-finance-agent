export interface Transaction {
  id: string;
  account_id: string;
  institution_name?: string;
  ext_transaction_id: string;
  amount: number;
  currency: string;
  raw_description: string;
  normalized_merchant?: string;
  category: string;
  sub_category?: string;
  confidence_score: number;
  is_anomaly: boolean;
  anomaly_reason?: string;
  transaction_time: string;
  processed_at: string;
}

export interface AnomalyAlert {
  transaction_id: string;
  merchant?: string;
  amount: number;
  category: string;
  reason: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface Account {
  id: string;
  institution_name: string;
  account_number_mask: string;
  currency: string;
}
