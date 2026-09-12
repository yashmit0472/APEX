import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { apexChain } from "./chains";

export const wagmiConfig = createConfig({
  chains: [apexChain],

  connectors: [
    injected({
      shimDisconnect: true,
    }),
  ],

  transports: {
    [apexChain.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545"
    ),
  },

  ssr: true,
});