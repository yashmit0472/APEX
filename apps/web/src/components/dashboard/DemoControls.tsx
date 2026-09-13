"use client";

import { useState } from "react";
import type { DemoState } from "../../hooks/useDemoState";

interface DemoControlsProps {
  state: DemoState | null;
  connected: boolean;
  error: string | null;
  onSubmitPrompt: (prompt: string) => Promise<boolean>;
  onReset: () => Promise<boolean>;
}

export function DemoControls({
  state,
  connected,
  error,
  onSubmitPrompt,
  onReset,
}: DemoControlsProps) {
  const [prompt, setPrompt] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const simState = state?.state;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setActionLoading(true);
    await onSubmitPrompt(prompt);
    setPrompt("");
    setActionLoading(false);
  };

  const handleReset = async () => {
    setActionLoading(true);
    await onReset();
    setActionLoading(false);
  };

  const formatUSDC = (amount: number) =>
    `$${(amount / 1_000_000).toFixed(2)}`;

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-zinc-950 p-6">
      {/* Demo Mode Badge */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            🎮
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white">
              Demo Mode
            </h2>

            <p className="text-xs text-zinc-500">
              Agent Task Execution Demo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              connected
                ? "bg-emerald-400 shadow-lg shadow-emerald-400/50"
                : "bg-red-400"
            }`}
          />

          <span className="text-xs text-zinc-500">
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Prompt Input Form */}
      <form onSubmit={handleSubmit} className="mb-5 flex gap-3">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Compare GPU pricing from 3 providers..."
          disabled={actionLoading || !connected}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={actionLoading || !connected || !prompt.trim()}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {actionLoading ? "Thinking..." : "Submit Task"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={actionLoading}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          title="Reset Demo State"
        >
          ↺
        </button>
      </form>

      {/* Quick Stats */}
      {simState && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickStat
            label="Vault Balance"
            value={formatUSDC(simState.agent.vaultBalance)}
          />
          <QuickStat
            label="Jobs"
            value={`${simState.stats.settledJobs}/${simState.stats.totalJobs}`}
            detail={`${simState.stats.activeJobs} active`}
          />
          <QuickStat
            label="Tasks"
            value={`${simState.stats.completedTasks}/${simState.stats.completedTasks + simState.stats.pendingTasks}`}
            detail={`${simState.stats.pendingTasks} pending`}
          />
          <QuickStat
            label="Treasury"
            value={formatUSDC(simState.treasuryBalance)}
            detail="from slashing"
          />
        </div>
      )}
    </section>
  );
}

function QuickStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-zinc-600">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-white">
        {value}
      </p>

      {detail && (
        <p className="mt-0.5 text-[10px] text-zinc-600">{detail}</p>
      )}
    </div>
  );
}
