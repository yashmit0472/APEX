"use client";

import {
  decodeEventLog,
  keccak256,
  parseUnits,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { useAccount, usePublicClient } from "wagmi";

import {
  paymentFirewallAbi,
  paymentRouterAbi,
} from "../abi";

import { CONTRACTS } from "../config/contracts";
import { useApexWrite } from "./useApexWrite";

export type FirewallDecision =
  | "AUTO_PAY"
  | "FLAG"
  | "REQUIRE_APPROVAL"
  | "BLOCK";

export type PaymentIntent = {
  requestId: Hex;
  agent: Address;
  provider: Address;
  amount: bigint;
  serviceId: Hex;
  deadline: bigint;
  nonce: bigint;
  stakeRequired: bigint;
};

export function usePaymentRouter() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const {
    writeContract,
    writeContractAsync,
    hash,
    receipt,
    isPending,
    isConfirming,
    isConfirmed,
    isReceiptError,
    error,
    reset,
  } = useApexWrite();

  function createRequestId(
    provider: Address,
    amount: bigint,
    serviceId: Hex,
    nonce: bigint
  ): Hex {
    return keccak256(
      stringToHex(
        `${address ?? ""}-${provider}-${amount.toString()}-${serviceId}-${nonce.toString()}`
      )
    );
  }

  async function executePayment(params: {
    provider: Address;
    amountUSDC: string;
    serviceId: string;
    deadline: bigint;
    nonce: bigint;
    stakeRequiredUSDC?: string;
  }) {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    const amount = parseUnits(
      params.amountUSDC,
      6
    );

    const stakeRequired = parseUnits(
      params.stakeRequiredUSDC || "0",
      6
    );

    const serviceId = keccak256(
      stringToHex(params.serviceId)
    );

    const requestId = createRequestId(
      params.provider,
      amount,
      serviceId,
      params.nonce
    );

    const intent: PaymentIntent = {
      requestId,
      agent: address,
      provider: params.provider,
      amount,
      serviceId,
      deadline: params.deadline,
      nonce: params.nonce,
      stakeRequired,
    };

    writeContract({
      address: CONTRACTS.PAYMENT_ROUTER,
      abi: paymentRouterAbi,
      functionName: "execute",
      args: [intent],
    });

    return requestId;
  }

  async function getPendingIntent(
    requestId: Hex
  ) {
    if (!publicClient) {
      throw new Error(
        "RPC client unavailable"
      );
    }

    return publicClient.readContract({
      address: CONTRACTS.PAYMENT_ROUTER,
      abi: paymentRouterAbi,
      functionName: "getPendingIntent",
      args: [requestId],
    });
  }

  async function getFirewallResult(
    transactionHash: Hex
  ): Promise<{
    score: bigint;
    decision: FirewallDecision;
    requestId: Hex;
  } | null> {
    if (!publicClient) {
      throw new Error(
        "RPC client unavailable"
      );
    }

    const transactionReceipt =
      await publicClient.waitForTransactionReceipt({
        hash: transactionHash,
      });

    for (const log of transactionReceipt.logs) {
      if (
        log.address.toLowerCase() !==
        CONTRACTS.PAYMENT_FIREWALL.toLowerCase()
      ) {
        continue;
      }

      try {
        const decoded = decodeEventLog({
          abi: paymentFirewallAbi,
          data: log.data,
          topics: log.topics,
        });

        if (
          decoded.eventName ===
          "RiskEvaluated"
        ) {
          const args = decoded.args as unknown as {
            requestId: Hex;
            score: bigint;
            decision: number;
          };

          return {
            requestId: args.requestId,
            score: args.score,
            decision:
              Number(args.decision) === 0
                ? "AUTO_PAY"
                : Number(args.decision) === 1
                  ? "FLAG"
                  : Number(args.decision) === 2
                    ? "REQUIRE_APPROVAL"
                    : "BLOCK",
          };
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  function executeApproved(
    requestId: Hex
  ) {
    return writeContractAsync({
      address: CONTRACTS.PAYMENT_ROUTER,
      abi: paymentRouterAbi,
      functionName: "executeApproved",
      args: [requestId],
    });
  }

  return {
    executePayment,
    executeApproved,
    getPendingIntent,
    getFirewallResult,

    hash,
    receipt,

    isPending,
    isConfirming,
    isConfirmed,
    isReceiptError,

    error,
    reset,
  };
}
