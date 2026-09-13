"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
} from "wagmi";

export function WalletConnect() {
  const {
    address,
    isConnected,
    connector: activeConnector,
  } = useAccount();

  const {
    connect,
    connectors,
    isPending,
    error,
  } = useConnect();

  const { disconnect } = useDisconnect();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  /*
   * Wagmi's connector list can differ between the
   * server render and the browser. Do not render
   * connector-dependent UI until hydration completes.
   */
  if (!mounted) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/40"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2">
          <p className="font-mono text-sm text-white">
            {address.slice(0, 6)}...
            {address.slice(-4)}
          </p>

          <p className="mt-1 text-xs text-white/40">
            {activeConnector?.name ?? "Connected"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            type="button"
            disabled={isPending}
            onClick={() => {
              if (!isConnected) {
                connect({ connector });
              }
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending
              ? "Connecting..."
              : `Connect ${connector.name}`}
          </button>
        ))}
      </div>

      {error && (
        <p className="max-w-sm text-right text-xs text-red-400">
          {error.message}
        </p>
      )}

      <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-white/50">
        <p>
          Connectors: {mounted ? connectors.length : "—"}
        </p>

        <p className="mt-2">
          Connector:{" "}
          {mounted ? (connectors
            .map((connector) => connector.name)
            .join(", ") || "None") : "—"}
        </p>
      </div>
    </div>
  );
}