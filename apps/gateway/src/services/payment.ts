import { env } from "../config/env.js";
import { walletClient, publicClient } from "../config/client.js";
import { agentSpendingVaultAbi } from "../config/contracts.js";
import type { PaymentRequest } from "../types/payment.js";
import { simulator } from "./simulator.js";

export async function executePayment(
  request: PaymentRequest
): Promise<`0x${string}`> {
  if (env.demoMode) {
    // In demo mode, validate spending through the simulator
    const validation = simulator.validateSpending(
      Number(request.amount)
    );

    if (!validation.valid) {
      throw new Error(
        `Demo payment rejected: ${validation.reason}`
      );
    }

    // Return a fake transaction hash
    return `0x${"d".repeat(64)}` as `0x${string}`;
  }

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