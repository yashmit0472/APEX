"use client";

import { usePublicClient } from "wagmi";

import { PaymentFirewallABI } from "../abi";
import { CONTRACTS } from "../config/contracts";

export type FirewallResult = {
  score: bigint;
  decision: number;
};

export function usePaymentFirewall() {
  const publicClient = usePublicClient();

  async function evaluatePayment(
    provider: `0x${string}`,
    amount: bigint,
    serviceId: `0x${string}`,
    stakeRequired: bigint
  ): Promise<FirewallResult | null> {
    if (!publicClient) {
      throw new Error("RPC client unavailable");
    }

    /*
     * The exact public firewall evaluation method is intentionally
     * resolved from the deployed contract ABI.
     *
     * This hook will be connected to the firewall's exposed read
     * method once its ABI signature is available.
     */
    return null;
  }

  return {
    evaluatePayment,
  };
}
