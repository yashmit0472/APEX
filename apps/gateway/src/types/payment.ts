export interface PaymentRequest {
  requestId: `0x${string}`;
  agent: `0x${string}`;
  provider: `0x${string}`;
  amount: string;
  serviceType: string;
}

export interface PaymentResponse {
  requestId: `0x${string}`;
  authorizationTx?: string;
  paymentTx?: string;
  escrowTx?: string;
  status: "accepted" | "submitted" | "failed";
}