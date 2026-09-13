"use client";

import { useState } from "react";
import type { DemoState } from "../../hooks/useDemoState";

interface DemoControlsProps {
  state: DemoState | null;
  connected: boolean;
  error: string | null;
  onStart: (speed?: number) => Promise<boolean>;
  onStop: () => Promise<boolean>;
  onReset: () => Promise<boolean>;
  onSpeedChange: (ms: number) => Promise<boolean>;
}

const SPEED_OPTIONS = [
  { label: "Slow (10s)", value: 10000 },
  { label: "Normal (5s)", value: 5000 },
  { label: "Fast (2s)", value: 2000 },
  { label: "Turbo (1s)", value: 1000 },
];

export function DemoControls({
  state,
  connected,
  error,
  onStart,
  onStop,
  onReset,
  onSpeedChange,
}: DemoControlsProps) {
  const [speed, setSpeed] = useState(5000);
  const [actionLoading, setActionLoading] = useState(false);

  const agentRunning = state?.agentRunning ?? false;
  const simState = state?.state;

  const handleStart = async () => {
    setActionLoading(true);
    await onStart(speed);
    setActionLoading(false);
  };

  const handleStop = async () => {
    setActionLoading(true);
    await onStop();
    setActionLoading(false);
  };

  const handleReset = async () => {
    setActionLoading(true);
    await onReset();
    setActionLoading(false);
  };

  const handleSpeedChange = async (ms: number) => {
    setSpeed(ms);
    await onSpeedChange(ms);
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
              Simulated payments — no real money
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

      {/* Control Buttons */}
      <div className="mb-5 flex flex-wrap gap-3">
        {!agentRunning ? (
          <button
            type="button"
            onClick={handleStart}
            disabled={actionLoading || !connected}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {actionLoading ? "Starting..." : "▶ Start Agent"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStop}
            disabled={actionLoading}
            className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {actionLoading ? "Stopping..." : "⏹ Stop Agent"}
          </button>
        )}

        <button
          type="button"
          onClick={handleReset}
          disabled={actionLoading}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ↺ Reset
        </button>
      </div>

      {/* Speed Controls */}
      <div className="mb-5">
        <p className="mb-2 text-xs uppercase tracking-wider text-zinc-600">
          Agent Speed
        </p>

        <div className="flex flex-wrap gap-2">
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSpeedChange(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                speed === opt.value
                  ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

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
