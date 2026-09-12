"use client";

import { useAccount, useBalance } from "wagmi";
import { PaymentRequest } from "./PaymentRequest";
import {
  useVaultAgent,
  useVaultDailySpent,
  useVaultPaused,
  useVaultPolicy,
  useVaultRemainingAllowance,
  useVaultRemainingDailyAllowance,
  useVaultTotalSpent,
} from "../../hooks/useApexContracts";

const formatUSDC = (value: unknown) => {
  if (value === undefined || value === null) return "—";
  return `$${(Number(value) / 1_000_000).toFixed(2)}`;
};

const formatAddress = (address: string | undefined) => {
  if (!address) return "—";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export function AgentDashboard() {
  const { address, isConnected } = useAccount();

  const { data: nativeBalance } = useBalance({
    address,
  });

  const { data: policy } = useVaultPolicy();
  const { data: remainingAllowance } = useVaultRemainingAllowance();
  const { data: remainingDailyAllowance } =
    useVaultRemainingDailyAllowance();
  const { data: totalSpent } = useVaultTotalSpent();
  const { data: dailySpent } = useVaultDailySpent();
  const { data: vaultAgent } = useVaultAgent();
  const { data: paused } = useVaultPaused();

  if (!isConnected || !address) {
    return (
      <div className="rounded-2xl border border-red-900/40 bg-zinc-950 p-8 text-center">
        <h2 className="text-xl font-semibold text-white">
          Connect your wallet
        </h2>

        <p className="mt-2 text-sm text-zinc-500">
          Connect an agent wallet to access the APEX dashboard.
        </p>
      </div>
    );
  }

  const maxSpend = (policy as readonly bigint[] | undefined)?.[0];
  const perTxCap = (policy as readonly bigint[] | undefined)?.[1];
  const dailyCap = (policy as readonly bigint[] | undefined)?.[2];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm font-medium text-red-500">
          AGENT DASHBOARD
        </p>

        <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
          Payment Control Center
        </h1>

        <p className="mt-2 text-sm text-zinc-500">
          Monitor your agent wallet, spending controls and payment activity.
        </p>
      </div>

      {/* Wallet */}
      <div className="rounded-2xl border border-red-900/40 bg-zinc-950 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              Connected Agent
            </p>

            <p className="mt-2 font-mono text-sm text-white">
              {formatAddress(address)}
            </p>

            <p className="mt-1 text-xs text-zinc-600">
              Vault agent: {formatAddress(vaultAgent as string | undefined)}
            </p>
          </div>

          <div className="text-left md:text-right">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              ETH Balance
            </p>

            <p className="mt-2 text-lg font-semibold text-white">
              {nativeBalance
                ? (Number(nativeBalance.value) / 10 ** nativeBalance.decimals).toFixed(4)
                : "0.0000"}{" "}
              ETH
            </p>
          </div>
        </div>
      </div>

      {/* Main stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Max Spend"
          value={formatUSDC(maxSpend)}
          description="Maximum authorized spend"
        />

        <StatCard
          title="Per TX Cap"
          value={formatUSDC(perTxCap)}
          description="Maximum per transaction"
        />

        <StatCard
          title="Daily Cap"
          value={formatUSDC(dailyCap)}
          description="Maximum daily spend"
        />

        <StatCard
          title="Total Spent"
          value={formatUSDC(totalSpent)}
          description="Total vault spending"
        />
      </div>

      {/* Allowances */}
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="Remaining Allowance"
          value={formatUSDC(remainingAllowance)}
          description="Remaining overall allowance"
        />

        <StatCard
          title="Remaining Daily"
          value={formatUSDC(remainingDailyAllowance)}
          description="Remaining daily allowance"
        />
      </div>

      {/* Payment Action */}
      <PaymentRequest />

      {/* Spending */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardPanel
          title="Spending"
          description="Current vault spending activity."
        >
          <StatusRow
            label="Total spent"
            value={formatUSDC(totalSpent)}
          />

          <StatusRow
            label="Today's spending"
            value={formatUSDC(dailySpent)}
          />

          <StatusRow
            label="Remaining allowance"
            value={formatUSDC(remainingAllowance)}
          />

          <StatusRow
            label="Remaining daily"
            value={formatUSDC(remainingDailyAllowance)}
          />
        </DashboardPanel>

        <DashboardPanel
          title="Vault Status"
          description="Current APEX vault configuration."
        >
          <StatusRow
            label="Wallet connected"
            value="Active"
            active
          />

          <StatusRow
            label="Vault"
            value={paused ? "Paused" : "Active"}
            active={!paused}
          />

          <StatusRow
            label="Agent"
            value={formatAddress(vaultAgent as string | undefined)}
          />

          <StatusRow
            label="Policy"
            value={policy ? "Configured" : "Loading"}
            active={!!policy}
          />
        </DashboardPanel>
      </div>

      {/* Recent activity */}
      <DashboardPanel
        title="Recent Activity"
        description="Latest payment and security events."
      >
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-center">
          <p className="text-sm text-zinc-500">
            No activity yet.
          </p>

          <p className="mt-1 text-xs text-zinc-600">
            Payment activity will appear here once transactions are executed.
          </p>
        </div>
      </DashboardPanel>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 transition hover:border-red-900/60">
      <p className="text-xs uppercase tracking-wider text-zinc-500">
        {title}
      </p>

      <p className="mt-3 text-2xl font-bold text-white">
        {value}
      </p>

      <p className="mt-1 text-xs text-zinc-600">
        {description}
      </p>
    </div>
  );
}

function DashboardPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">
          {title}
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          {description}
        </p>
      </div>

      <div className="space-y-3">
        {children}
      </div>
    </section>
  );
}

function StatusRow({
  label,
  value,
  active = false,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <span className="text-sm text-zinc-400">
        {label}
      </span>

      <span
        className={`flex items-center gap-2 text-sm font-medium ${
          active ? "text-red-400" : "text-zinc-500"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            active ? "bg-red-500" : "bg-zinc-600"
          }`}
        />

        {value}
      </span>
    </div>
  );
}
