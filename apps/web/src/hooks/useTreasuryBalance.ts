"use client";

import { useBalance } from "wagmi";

const TREASURY_ADDRESS =
  process.env
    .NEXT_PUBLIC_TREASURY_ADDRESS as
    | `0x${string}`
    | undefined;

export function useTreasuryBalance() {
  return useBalance({
    address: TREASURY_ADDRESS,
    query: {
      enabled: Boolean(
        TREASURY_ADDRESS
      ),
    },
  });
}