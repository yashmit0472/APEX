"use client";

import {
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

export function useApexWrite() {
  const {
    writeContract,
    writeContractAsync,
    data: hash,
    isPending,
    isSuccess,
    error,
    reset,
  } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isReceiptError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    writeContract,
    writeContractAsync,
    hash,
    receipt,
    isPending,
    isSuccess,
    isConfirming,
    isConfirmed,
    isReceiptError,
    error,
    reset,
  };
}
