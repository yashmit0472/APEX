"use client";

import {
  useVaultAgent,
  useVaultDailySpent,
  useVaultPaused,
  useVaultPolicy,
  useVaultRemainingAllowance,
  useVaultRemainingDailyAllowance,
  useVaultTotalSpent,
} from "./useApexContracts";

function bigintToNumber(
  value: unknown
): number {
  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}

export function useDashboardData() {
  const agent = useVaultAgent();
  const dailySpent = useVaultDailySpent();
  const paused = useVaultPaused();
  const policy = useVaultPolicy();
  const remainingAllowance =
    useVaultRemainingAllowance();
  const remainingDailyAllowance =
    useVaultRemainingDailyAllowance();
  const totalSpent = useVaultTotalSpent();

  const policyData = policy.data as
    | readonly bigint[]
    | undefined;

  const maxSpend =
    policyData?.[0] ??
    BigInt(0);

  const perTxCap =
    policyData?.[1] ??
    BigInt(0);

  const dailyCap =
    policyData?.[2] ??
    BigInt(0);

  return {
    agent: agent.data,

    dailySpent: bigintToNumber(
      dailySpent.data
    ),

    paused: Boolean(paused.data),

    maxSpend: bigintToNumber(maxSpend),

    perTxCap: bigintToNumber(perTxCap),

    dailyCap: bigintToNumber(dailyCap),

    remainingAllowance:
      bigintToNumber(
        remainingAllowance.data
      ),

    remainingDailyAllowance:
      bigintToNumber(
        remainingDailyAllowance.data
      ),

    totalSpent:
      bigintToNumber(
        totalSpent.data
      ),

    loading:
      agent.isLoading ||
      dailySpent.isLoading ||
      paused.isLoading ||
      policy.isLoading ||
      remainingAllowance.isLoading ||
      remainingDailyAllowance.isLoading ||
      totalSpent.isLoading,
  };
}