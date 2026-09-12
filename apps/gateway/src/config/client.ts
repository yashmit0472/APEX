import {
  createPublicClient,
  createWalletClient,
  http
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import { env } from "./env.js";

export const apexChain = defineChain({
  id: env.chainId,
  name: "APEX Local Chain",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [env.rpcUrl]
    }
  }
});

export const account = privateKeyToAccount(
  env.agentPrivateKey
);

export const publicClient = createPublicClient({
  chain: apexChain,
  transport: http(env.rpcUrl)
});

export const walletClient = createWalletClient({
  account,
  chain: apexChain,
  transport: http(env.rpcUrl)
});