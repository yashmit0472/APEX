import { defineChain } from "viem";

export const apexChain = defineChain({
  id: 31337,
  name: "APEX Anvil",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
  },
});

export const apexChainId = apexChain.id;