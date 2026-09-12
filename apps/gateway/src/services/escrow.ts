import { env } from "../config/env.js";
import { walletClient, publicClient } from "../config/client.js";
import { paymentEscrowAbi } from "../config/contracts.js";
import type { PaymentRequest } from "../types/payment.js";

export async function createEscrowJob(
  request: PaymentRequest
): Promise<`0x${string}`> {
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