import { env } from "../config/env.js";
import { publicClient } from "../config/client.js";
import { agentAuthorizationAbi } from "../config/contracts.js";
import type { PaymentRequest } from "../types/payment.js";
import { simulator } from "./simulator.js";

export async function validateAuthorization(
  request: PaymentRequest
): Promise<boolean> {
  if (env.demoMode) {
    // In demo mode, validate against the in-memory policy engine
    const validation = simulator.validateSpending(
      Number(request.amount)
    );

    return validation.valid;
  }

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