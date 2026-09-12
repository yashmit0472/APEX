import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),

  rpcUrl: required("RPC_URL"),

  chainId: Number(process.env.CHAIN_ID ?? 31337),

  agentPrivateKey: required("AGENT_PRIVATE_KEY") as `0x${string}`,

  agentAddress: required("AGENT_ADDRESS") as `0x${string}`,

  agentAuthorizationAddress:
    required("AGENT_AUTHORIZATION_ADDRESS") as `0x${string}`,

  agentSpendingVaultAddress:
    required("AGENT_SPENDING_VAULT_ADDRESS") as `0x${string}`,

  paymentEscrowAddress:
    required("PAYMENT_ESCROW_ADDRESS") as `0x${string}`,

  requestTimeoutMs: Number(
    process.env.REQUEST_TIMEOUT_MS ?? 30000
  )
};