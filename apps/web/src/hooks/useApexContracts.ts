"use client";

import { useReadContract } from "wagmi";
import { AgentSpendingVaultABI } from "../abi";
import { contracts } from "../config/contracts";

export function useVaultPolicy() {
  return useReadContract({
    address: contracts.agentSpendingVault.address,
    abi: AgentSpendingVaultABI,
    functionName: "policy",
  });
}

export function useVaultRemainingAllowance() {
  return useReadContract({
    address: contracts.agentSpendingVault.address,
    abi: AgentSpendingVaultABI,
    functionName: "remainingAllowance",
  });
}

export function useVaultRemainingDailyAllowance() {
  return useReadContract({
    address: contracts.agentSpendingVault.address,
    abi: AgentSpendingVaultABI,
    functionName: "remainingDailyAllowance",
  });
}

export function useVaultTotalSpent() {
  return useReadContract({
    address: contracts.agentSpendingVault.address,
    abi: AgentSpendingVaultABI,
    functionName: "totalSpent",
  });
}

export function useVaultDailySpent() {
  return useReadContract({
    address: contracts.agentSpendingVault.address,
    abi: AgentSpendingVaultABI,
    functionName: "dailySpent",
  });
}

export function useVaultAgent() {
  return useReadContract({
    address: contracts.agentSpendingVault.address,
    abi: AgentSpendingVaultABI,
    functionName: "agent",
  });
}

export function useVaultPaused() {
  return useReadContract({
    address: contracts.agentSpendingVault.address,
    abi: AgentSpendingVaultABI,
    functionName: "paused",
  });
}
