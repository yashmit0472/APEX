"use client";

import Link from "next/link";
import { useAccount, useChainId, useBalance } from "wagmi";
import { WalletConnect } from "../components/WalletConnect";
import { apexChain } from "../config/chains";

export default function Home() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({ address });

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between border-b border-red-950/60 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-red-500">
              APEX
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Agent Payment EXecution
            </p>
          </div>

          <WalletConnect />
        </header>

        <section className="flex flex-1 flex-col justify-center py-20">
          <div className="max-w-4xl">
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-red-500">
              Agent Payment Infrastructure
            </p>

            <h2 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
              Secure payments for autonomous agents.
            </h2>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
              Authorization, risk evaluation, spending controls, escrow,
              staking, and settlement in one payment execution layer.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <InfoCard title="Authorization" value="Protected" />
              <InfoCard title="Firewall" value="Active" />
              <InfoCard title="Escrow" value="On-chain" />
            </div>

            <div className="mt-8 rounded-2xl border border-red-950/70 bg-[#0d0d0d] p-6">
              <h3 className="text-lg font-semibold">Network</h3>

              <div className="mt-4 space-y-2 text-sm text-zinc-400">
                <p>
                  Chain:{" "}
                  <span className="text-white">
                    {chainId === apexChain.id
                      ? "APEX Anvil"
                      : chainId || "Not connected"}
                  </span>
                </p>

                <p>
                  Chain ID:{" "}
                  <span className="text-white">{apexChain.id}</span>
                </p>

                {isConnected && address && (
                  <p className="break-all">
                    Wallet: <span className="text-white">{address}</span>
                  </p>
                )}
              </div>
            </div>

            {address && (
              <div className="mt-6 rounded-xl border border-red-900/40 bg-zinc-950 p-5">
                <p className="text-sm text-zinc-400">Wallet</p>

                <p className="mt-1 font-mono text-sm text-white">
                  {address}
                </p>

                <p className="mt-4 text-sm text-zinc-400">ETH Balance</p>

                <p className="mt-1 text-lg font-semibold text-red-500">
                  {balance
                    ? `${(Number(balance.value) / 10 ** balance.decimals).toFixed(4)} ${balance.symbol}`
                    : "Loading..."}
                </p>

                <div className="mt-6">
                  <Link
                    href="/dashboard"
                    className="rounded-lg border border-red-700 bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500"
                  >
                    Open Dashboard
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="border-t border-red-950/60 pt-6 text-sm text-zinc-600">
          APEX · Agent Payment EXecution
        </footer>
      </div>
    </main>
  );
}

function InfoCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-red-950/60 bg-[#0d0d0d] p-5">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-2 text-lg font-semibold text-red-400">{value}</p>
    </div>
  );
}
