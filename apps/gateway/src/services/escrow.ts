import { env } from "../config/env.js";
import { walletClient, publicClient } from "../config/client.js";
import { paymentEscrowAbi } from "../config/contracts.js";
import type { PaymentRequest } from "../types/payment.js";
import { simulator } from "./simulator.js";

export async function createEscrowJob(
  request: PaymentRequest
): Promise<`0x${string}`> {
  if (env.demoMode) {
    // In demo mode, create a simulated escrow job
    const job = simulator.createJob(
      request.provider,
      Number(request.amount),
      0, // stakeRequired — will be set by agent
      Date.now() + 60 * 1000,
      request.serviceType,
      `API request: ${request.serviceType}`
    );

    if (!job) {
      throw new Error("Demo escrow job creation failed");
    }

    // Return a fake transaction hash
    return `0x${"e".repeat(64)}` as `0x${string}`;
  }

  const hash = await walletClient.writeContract({
    address: env.paymentEscrowAddress,
    abi: paymentEscrowAbi,
    functionName: "createJob",
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