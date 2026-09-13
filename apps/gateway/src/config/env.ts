import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

const demoMode = process.env.DEMO_MODE === "true";

export const env = {
  port: Number(process.env.PORT ?? 3001),

  demoMode,

  // On-chain config — only required when NOT in demo mode
  rpcUrl: demoMode
    ? (optional("RPC_URL") ?? "http://127.0.0.1:8545")
    : required("RPC_URL"),

  chainId: Number(process.env.CHAIN_ID ?? 31337),

  agentPrivateKey: demoMode
    ? ((optional("AGENT_PRIVATE_KEY") ??
        "0x0000000000000000000000000000000000000000000000000000000000000001") as `0x${string}`)
    : (required("AGENT_PRIVATE_KEY") as `0x${string}`),

  agentAddress: demoMode
    ? ((optional("AGENT_ADDRESS") ??
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266") as `0x${string}`)
    : (required("AGENT_ADDRESS") as `0x${string}`),

  agentAuthorizationAddress: demoMode
    ? ((optional("AGENT_AUTHORIZATION_ADDRESS") ??
        "0x0000000000000000000000000000000000000000") as `0x${string}`)
    : (required("AGENT_AUTHORIZATION_ADDRESS") as `0x${string}`),

  agentSpendingVaultAddress: demoMode
    ? ((optional("AGENT_SPENDING_VAULT_ADDRESS") ??
        "0x0000000000000000000000000000000000000000") as `0x${string}`)
    : (required("AGENT_SPENDING_VAULT_ADDRESS") as `0x${string}`),

  paymentEscrowAddress: demoMode
    ? ((optional("PAYMENT_ESCROW_ADDRESS") ??
        "0x0000000000000000000000000000000000000000") as `0x${string}`)
    : (required("PAYMENT_ESCROW_ADDRESS") as `0x${string}`),

  requestTimeoutMs: Number(
    process.env.REQUEST_TIMEOUT_MS ?? 30000
  ),

  // Demo-specific config
  demoAgentSpeed: Number(
    process.env.DEMO_AGENT_SPEED ?? 5000
  ),
  demoProviderReliability: Number(
    process.env.DEMO_PROVIDER_RELIABILITY ?? 0.9
  ),
  demoInitialBalance: Number(
    process.env.DEMO_INITIAL_BALANCE ?? 500_000_000
  ),
};