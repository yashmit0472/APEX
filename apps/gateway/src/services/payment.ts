import { env } from "../config/env.js";
import { walletClient, publicClient } from "../config/client.js";
import { agentSpendingVaultAbi } from "../config/contracts.js";
import type { PaymentRequest } from "../types/payment.js";

export async function executePayment(
  request: PaymentRequest
): Promise<`0x${string}`> {
  const hash = await walletClient.writeContract({
    address: env.agentSpendingVaultAddress,
    abi: agentSpendingVaultAbi,
    functionName: "pay",
    args: [
      request.requestId,
      request.provider,
      BigInt(request.amount)
    ]
  });

  await publicClient.waitForTransactionReceipt({
    hash
  });

  return hash;
}