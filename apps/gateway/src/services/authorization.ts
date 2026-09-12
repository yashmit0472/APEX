import { publicClient } from "../config/client.js";
import { env } from "../config/env.js";
import { agentAuthorizationAbi } from "../config/contracts.js";
import type { PaymentRequest } from "../types/payment.js";

export async function validateAuthorization(
  request: PaymentRequest
): Promise<boolean> {
  const result = await publicClient.readContract({
    address: env.agentAuthorizationAddress,
    abi: agentAuthorizationAbi,
    functionName: "validatePaymentIntent",
    args: [
      request.agent,
      request.provider,
      BigInt(request.amount),
      request.serviceType,
      request.requestId
    ]
  });

  return result;
}