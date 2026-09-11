export type PaymentDecision =
  | "AUTO_PAY"
  | "FLAG"
  | "APPROVAL_REQUIRED"
  | "BLOCKED";

export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "DELIVERED"
  | "VERIFIED"
  | "SETTLED"
  | "REFUNDED"
  | "FAILED";