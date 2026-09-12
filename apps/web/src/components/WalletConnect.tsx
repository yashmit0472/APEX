"use client";

import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { apexChain } from "../config/chains";

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const connector = connectors[0];

  if (!isConnected) {
    return (
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => connector && connect({ connector })}
          disabled={isPending || !connector}
          className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Connecting..." : "Connect Wallet"}
        </button>

        {error && (
          <p className="max-w-sm text-right text-xs text-red-400">
            {error.message}
          </p>
        )}
      </div>
    );
  }

  if (chainId !== apexChain.id) {
    return (
      <button
        type="button"
        onClick={() => switchChain({ chainId: apexChain.id })}
        disabled={isSwitching}
        className="rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
      >
        {isSwitching ? "Switching..." : "Switch to APEX Network"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="rounded-lg border border-red-900/50 bg-zinc-900 px-4 py-2 text-sm">
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-500" />
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </div>

      <button
        type="button"
        onClick={() => disconnect()}
        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-red-600 hover:text-white"
      >
        Disconnect
      </button>
    </div>
  );
}
