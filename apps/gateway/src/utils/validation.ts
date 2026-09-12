import type { PaymentRequest } from "../types/payment.js";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const BYTES32_REGEX = /^0x[a-fA-F0-9]{64}$/;

export function validatePaymentRequest(
  request: PaymentRequest
): void {
  if (!request.requestId || !BYTES32_REGEX.test(request.requestId)) {
    throw new Error("Invalid requestId");
  }

  if (!request.agent || !ADDRESS_REGEX.test(request.agent)) {
    throw new Error("Invalid agent address");
  }

  if (!request.provider || !ADDRESS_REGEX.test(request.provider)) {
    throw new Error("Invalid provider address");
  }

  if (!request.amount || !/^[0-9]+$/.test(request.amount)) {
    throw new Error("Invalid amount");
  }

  if (BigInt(request.amount) <= 0n) {
    throw new Error("Amount must be greater than zero");
  }

  if (!request.serviceType || request.serviceType.trim().length === 0) {
    throw new Error("Invalid service type");
  }
}