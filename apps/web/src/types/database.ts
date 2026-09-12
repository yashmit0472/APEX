export type PaymentStatus =
  | "created"
  | "pending"
  | "approved"
  | "executed"
  | "blocked"
  | "failed"
  | "settled"
  | "refunded";

export type FirewallDecision =
  | "AUTO_PAY"
  | "FLAG"
  | "REQUIRE_APPROVAL"
  | "BLOCK";

export type EscrowStatus =
  | "funded"
  | "delivered"
  | "settled"
  | "refunded"
  | "disputed";

export interface Agent {
  id: string;
  wallet_address: string;
  display_name: string | null;
  authorization_status: string;
  provider_address: string | null;
  service_id: string | null;
  max_spend: string | null;
  per_tx_cap: string | null;
  daily_cap: string | null;
  total_spent: string;
  daily_spent: string;
  authorization_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Provider {
  id: string;
  wallet_address: string;
  service_type: string;
  endpoint: string | null;
  active: boolean;
  registered_at: string | null;
  stake_amount: string;
  locked_stake: string;
  eligible: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentIntent {
  id: string;
  request_id: string;
  agent_address: string;
  provider_address: string;
  amount: string;
  service_id: string;
  deadline: string;
  nonce: string;
  stake_required: string;
  risk_score: number | null;
  firewall_decision: FirewallDecision | null;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
}

export interface EscrowJob {
  id: string;
  job_id: string;
  request_id: string;
  agent_address: string;
  provider_address: string;
  amount: string;
  stake_required: string;
  deadline: string;
  service_id: string;
  status: EscrowStatus;
  delivery_hash: string | null;
  funded_at: string | null;
  delivered_at: string | null;
  settled_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}
