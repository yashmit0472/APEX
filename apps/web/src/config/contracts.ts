import {
  AgentSpendingVaultABI,
  ProviderRegistryABI,
  StakeManagerABI,
  PaymentEscrowABI,
  AgentAuthorizationABI,
  PaymentFirewallABI,
  PaymentRouterABI,
} from "../abi";

export const contracts = {
  agentSpendingVault: {
    address: process.env.NEXT_PUBLIC_AGENT_VAULT_ADDRESS as `0x${string}`,
    abi: AgentSpendingVaultABI,
  },

  providerRegistry: {
    address: process.env
      .NEXT_PUBLIC_PROVIDER_REGISTRY_ADDRESS as `0x${string}`,
    abi: ProviderRegistryABI,
  },

  stakeManager: {
    address: process.env
      .NEXT_PUBLIC_STAKE_MANAGER_ADDRESS as `0x${string}`,
    abi: StakeManagerABI,
  },

  paymentEscrow: {
    address: process.env.NEXT_PUBLIC_ESCROW_ADDRESS as `0x${string}`,
    abi: PaymentEscrowABI,
  },

  agentAuthorization: {
    address: process.env
      .NEXT_PUBLIC_AGENT_AUTHORIZATION_ADDRESS as `0x${string}`,
    abi: AgentAuthorizationABI,
  },

  paymentFirewall: {
    address: process.env
      .NEXT_PUBLIC_PAYMENT_FIREWALL_ADDRESS as `0x${string}`,
    abi: PaymentFirewallABI,
  },

  paymentRouter: {
    address: process.env
      .NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS as `0x${string}`,
    abi: PaymentRouterABI,
  },
} as const;

export const CONTRACTS = {
  AGENT_VAULT:
    process.env.NEXT_PUBLIC_AGENT_VAULT_ADDRESS as `0x${string}`,

  PROVIDER_REGISTRY:
    process.env.NEXT_PUBLIC_PROVIDER_REGISTRY_ADDRESS as `0x${string}`,

  STAKE_MANAGER:
    process.env.NEXT_PUBLIC_STAKE_MANAGER_ADDRESS as `0x${string}`,

  PAYMENT_ESCROW:
    process.env.NEXT_PUBLIC_ESCROW_ADDRESS as `0x${string}`,

  AGENT_AUTHORIZATION:
    process.env.NEXT_PUBLIC_AGENT_AUTHORIZATION_ADDRESS as `0x${string}`,

  PAYMENT_FIREWALL:
    process.env.NEXT_PUBLIC_PAYMENT_FIREWALL_ADDRESS as `0x${string}`,

  PAYMENT_ROUTER:
    process.env.NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS as `0x${string}`,

  USDC:
    process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`,
} as const;
