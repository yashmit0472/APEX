"use client";

import { useEffect, useState } from "react";
import { useAccount, useBalance } from "wagmi";

import { PaymentRequest } from "./PaymentRequest";
import { WalletConnect } from "./WalletConnect";
import { ActivityTable } from "./ActivityTable";

import { useActivity } from "../../hooks/useActivity";

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
  const numericValue = toNumber(value);

  if (numericValue === null) return "—";

  return `$${(numericValue / 1_000_000).toFixed(2)}`;
};

const formatAddress = (address: string | undefined) => {
  if (!address) return "—";

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatETH = (
  value: bigint | undefined,
  decimals: number | undefined
) => {
  if (value === undefined || decimals === undefined) {
    return "0.0000";
  }

  return (Number(value) / 10 ** decimals).toFixed(4);
};

/**
 * Safely converts values returned by wagmi/viem
 * into a JavaScript number.
 *
 * We intentionally use this instead of bigint literals
 * because the project TypeScript target is below ES2020.
 */
const toNumber = (value: unknown): number | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export function AgentDashboard() {
  /*
   * Hydration protection.
   *
   * This prevents wallet-dependent UI from rendering differently
   * between the server and browser.
   */
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { address, isConnected } = useAccount();

  const { data: nativeBalance } = useBalance({
    address,
  });

  const { data: policy } = useVaultPolicy();

  const { data: remainingAllowance } =
    useVaultRemainingAllowance();

  const { data: remainingDailyAllowance } =
    useVaultRemainingDailyAllowance();

  const { data: totalSpent } = useVaultTotalSpent();

  const { data: dailySpent } = useVaultDailySpent();

  const { data: vaultAgent } = useVaultAgent();

  const { data: paused } = useVaultPaused();

  /*
   * Activity data
   *
   * This is now connected to the activity hook instead of
   * the old hard-coded "No payment activity yet" table.
   */
  const {
    activities,
    isLoading: activityLoading,
    error: activityError,
    refresh: refreshActivity,
  } = useActivity();

  /*
   * Latest firewall decision returned by PaymentRequest.
   */
  const [latestDecision, setLatestDecision] = useState<{
    requestId: `0x${string}`;
    score: bigint;
    decision:
    | "AUTO_PAY"
    | "FLAG"
    | "REQUIRE_APPROVAL"
    | "BLOCK";
  } | null>(null);

  /*
   * Don't render wallet-dependent UI until mounted.
   */
  if (!mounted) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-sm text-white/40">
          Loading APEX...
        </div>
      </div>
    );
  }

  /*
   * Wallet connection state.
   */
  if (!isConnected || !address) {
    return (
      <div className="rounded-2xl border border-red-900/40 bg-zinc-950 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-xl text-red-400">
          !
        </div>

        <h2 className="mt-4 text-xl font-semibold text-white">
          Connect your wallet
        </h2>

        <p className="mt-2 text-sm text-zinc-500">
          Connect an agent wallet to access the APEX dashboard.
        </p>

        <div className="mt-6 flex justify-center">
          <WalletConnect />
        </div>
      </div>
    );
  }

  /*
   * The policy returned by the existing hook is:
   *
   * [0] = maxSpend
   * [1] = perTxCap
   * [2] = dailyCap
   */
  const policyData =
    policy as readonly unknown[] | undefined;

  const maxSpend = policyData?.[0];
  const perTxCap = policyData?.[1];
  const dailyCap = policyData?.[2];

  /*
   * Convert blockchain values to normal numbers for
   * dashboard calculations.
   */
  const maxSpendNumber =
    toNumber(maxSpend) ?? 0;

  const perTxCapNumber =
    toNumber(perTxCap) ?? 0;

  const dailyCapNumber =
    toNumber(dailyCap) ?? 0;

  const remainingAllowanceNumber =
    toNumber(remainingAllowance) ?? 0;

  const remainingDailyAllowanceNumber =
    toNumber(remainingDailyAllowance) ?? 0;

  const totalSpentNumber =
    toNumber(totalSpent) ?? 0;

  const dailySpentNumber =
    toNumber(dailySpent) ?? 0;

  /*
   * Calculate allowance percentages using normal numbers.
   */
  const remainingPercentage =
    maxSpendNumber > 0
      ? Math.min(
        100,
        Math.max(
          0,
          (remainingAllowanceNumber /
            maxSpendNumber) *
          100
        )
      )
      : 0;

  const dailyRemainingPercentage =
    dailyCapNumber > 0
      ? Math.min(
        100,
        Math.max(
          0,
          (remainingDailyAllowanceNumber /
            dailyCapNumber) *
          100
        )
      )
      : 0;

  const vaultIsActive = !Boolean(paused);

  /*
   * Latest firewall values.
   */
  const firewallScore = latestDecision
    ? Number(latestDecision.score)
    : null;

  const firewallDecision =
    latestDecision?.decision ?? null;

  return (
    <div className="space-y-6">

      {/* ====================================================== */}
      {/* HEADER                                                  */}
      {/* ====================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium tracking-wider text-red-500">
              APEX
            </p>

            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${vaultIsActive
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/20 bg-red-500/10 text-red-400"
                }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${vaultIsActive
                    ? "bg-emerald-400"
                    : "bg-red-400"
                  }`}
              />

              Firewall{" "}
              {vaultIsActive
                ? "Active"
                : "Paused"}
            </span>
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Payment Control Center
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            Monitor autonomous payments, spending limits,
            firewall status and on-chain enforcement.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">
            Connected Wallet
          </p>

          <p className="mt-1 font-mono text-sm text-white">
            {formatAddress(address)}
          </p>
        </div>
      </div>

      {/* ====================================================== */}
      {/* WALLET / AGENT                                          */}
      {/* ====================================================== */}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="grid gap-5 md:grid-cols-3">

          <InfoBlock
            label="Connected Wallet"
            value={formatAddress(address)}
            mono
          />

          <InfoBlock
            label="Vault Agent"
            value={formatAddress(
              vaultAgent as string | undefined
            )}
            mono
          />

          <InfoBlock
            label="Native Balance"
            value={`${formatETH(
              nativeBalance?.value,
              nativeBalance?.decimals
            )} ETH`}
          />

        </div>
      </section>

      {/* ====================================================== */}
      {/* FINANCIAL STATE                                         */}
      {/* ====================================================== */}

      <section>
        <SectionHeading
          title="Financial State"
          description="Live spending state read directly from the APEX vault."
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <MetricCard
            title="Agent Allowance"
            value={formatUSDC(maxSpend)}
            description="Maximum authorized spend"
          />

          <MetricCard
            title="Total Spent"
            value={formatUSDC(totalSpent)}
            description="Total vault spending"
          />

          <MetricCard
            title="Remaining"
            value={formatUSDC(
              remainingAllowance
            )}
            description="Available overall allowance"
            status={
              remainingAllowanceNumber > 0
                ? "success"
                : "danger"
            }
          />

          <MetricCard
            title="Spent Today"
            value={formatUSDC(dailySpent)}
            description={`Daily cap ${formatUSDC(
              dailyCap
            )}`}
            status={
              dailySpentNumber <
                dailyCapNumber
                ? "success"
                : "warning"
            }
          />

        </div>
      </section>

      {/* ====================================================== */}
      {/* POLICY LIMITS                                           */}
      {/* ====================================================== */}

      <section>
        <SectionHeading
          title="Spending Policy"
          description="Hard limits enforced by the smart contract."
        />

        <div className="grid gap-4 md:grid-cols-3">

          <MetricCard
            title="Per Transaction Cap"
            value={formatUSDC(perTxCap)}
            description="Maximum single payment"
          />

          <MetricCard
            title="Daily Cap"
            value={formatUSDC(dailyCap)}
            description="Maximum daily spending"
          />

          <MetricCard
            title="Remaining Daily"
            value={formatUSDC(
              remainingDailyAllowance
            )}
            description="Available today"
            status={
              remainingDailyAllowanceNumber > 0
                ? "success"
                : "danger"
            }
          />

        </div>
      </section>

      {/* ====================================================== */}
      {/* ALLOWANCE VISUALIZATION                                 */}
      {/* ====================================================== */}

      <section className="grid gap-6 lg:grid-cols-2">

        <ProgressPanel
          title="Overall Allowance"
          description="Remaining authorized lifetime spend."
          percentage={remainingPercentage}
          value={`${formatUSDC(
            remainingAllowance
          )} remaining`}
        />

        <ProgressPanel
          title="Daily Allowance"
          description="Remaining spending capacity for today."
          percentage={dailyRemainingPercentage}
          value={`${formatUSDC(
            remainingDailyAllowance
          )} remaining`}
        />

      </section>

      {/* ====================================================== */}
      {/* FIREWALL                                                */}
      {/* ====================================================== */}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">

        <SectionHeading
          title="Firewall Decision"
          description="Risk evaluation for the latest payment request."
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">

          {/* Risk score */}

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">

            <p className="text-xs uppercase tracking-wider text-zinc-600">
              Risk Score
            </p>

            <div className="mt-4 flex items-end gap-3">

              <span className="text-5xl font-bold text-white">
                {firewallScore ?? "—"}
              </span>

              <span className="mb-2 text-sm text-zinc-600">
                / 100
              </span>

            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">

              <div
                className="h-full rounded-full bg-red-500 transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      firewallScore ?? 0
                    )
                  )}%`,
                }}
              />

            </div>

            <div className="mt-4">

              <span className="inline-flex rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">

                {firewallDecision
                  ? firewallDecision.replace(
                    "_",
                    " "
                  )
                  : "NO ACTIVE REQUEST"}

              </span>

            </div>

            {latestDecision && (
              <div className="mt-5 border-t border-zinc-800 pt-4">

                <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                  Request ID
                </p>

                <p className="mt-2 break-all font-mono text-xs text-zinc-400">
                  {latestDecision.requestId}
                </p>

              </div>
            )}

          </div>

          {/* Risk factors */}

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">

            <p className="text-xs uppercase tracking-wider text-zinc-600">
              Risk Factors
            </p>

            <div className="mt-4 space-y-3">

              <RiskRow
                label="Amount Risk"
                value="—"
              />

              <RiskRow
                label="Budget Risk"
                value="—"
              />

              <RiskRow
                label="Provider Risk"
                value="—"
              />

              <RiskRow
                label="Frequency Risk"
                value="—"
              />

              <RiskRow
                label="Reputation Risk"
                value="—"
              />

            </div>

            <div className="mt-5 border-t border-zinc-800 pt-4">

              <div className="flex items-center justify-between">

                <span className="text-sm text-zinc-500">
                  Decision
                </span>

                <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-500">
                  {firewallDecision
                    ? firewallDecision.replace(
                      "_",
                      " "
                    )
                    : "WAITING FOR REQUEST"}
                </span>

              </div>

            </div>

          </div>

        </div>

        <div className="mt-5 rounded-xl border border-dashed border-zinc-800 bg-black/20 p-4">

          <p className="text-xs leading-5 text-zinc-600">
            Firewall risk information is displayed from
            recorded payment decisions. No risk score is
            fabricated when no request exists.
          </p>

        </div>

      </section>

      {/* ====================================================== */}
      {/* PAYMENT ACTION                                          */}
      {/* ====================================================== */}

      <PaymentRequest
        onFirewallDecision={setLatestDecision}
      />

      {/* ====================================================== */}
      {/* PROVIDERS                                               */}
      {/* ====================================================== */}

      <section>

        <SectionHeading
          title="Providers"
          description="Registered service providers and payment eligibility."
        />

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">

          <div className="grid gap-4 md:grid-cols-3">

            <ProviderCard
              title="Registered Providers"
              value="—"
              description="Provider registry data"
            />

            <ProviderCard
              title="Eligible Providers"
              value="—"
              description="Providers meeting stake requirements"
            />

            <ProviderCard
              title="Provider Risk"
              value="—"
              description="Latest provider risk state"
            />

          </div>

          <div className="mt-5 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-6 text-center">

            <p className="text-sm text-zinc-500">
              Provider activity will appear here once
              provider/indexer data is available.
            </p>

            <p className="mt-1 text-xs text-zinc-700">
              On-chain eligibility remains authoritative.
            </p>

          </div>

        </div>

      </section>

      {/* ====================================================== */}
      {/* SPENDING + VAULT STATUS                                 */}
      {/* ====================================================== */}

      <div className="grid gap-6 lg:grid-cols-2">

        <DashboardPanel
          title="Spending"
          description="Current vault spending state."
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
            value={formatUSDC(
              remainingAllowance
            )}
          />

          <StatusRow
            label="Remaining daily"
            value={formatUSDC(
              remainingDailyAllowance
            )}
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
            value={
              paused
                ? "Paused"
                : "Active"
            }
            active={!paused}
          />

          <StatusRow
            label="Agent"
            value={formatAddress(
              vaultAgent as string | undefined
            )}
          />

          <StatusRow
            label="Policy"
            value={
              policy
                ? "Configured"
                : "Loading"
            }
            active={!!policy}
          />

        </DashboardPanel>

      </div>

      {/* ====================================================== */}
      {/* RECENT ACTIVITY                                         */}
      {/* ====================================================== */}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">

        <div className="mb-5 flex items-center justify-between">

          <div>
            <h2 className="text-lg font-semibold text-white">
              Recent Activity
            </h2>

            <p className="mt-1 text-sm text-white/40">
              Recent payment and firewall activity
            </p>
          </div>

          <button
            type="button"
            onClick={refreshActivity}
            disabled={activityLoading}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {activityLoading
              ? "Refreshing..."
              : "Refresh"}
          </button>

        </div>

        {activityLoading ? (

          <div className="py-10 text-center text-sm text-white/40">
            Loading activity...
          </div>

        ) : activityError ? (

          <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-5 text-center">

            <p className="text-sm text-red-300">
              Unable to load activity.
            </p>

            <button
              type="button"
              onClick={refreshActivity}
              className="mt-3 rounded-lg border border-red-900/50 px-3 py-2 text-xs text-red-300 hover:bg-red-950/40"
            >
              Retry
            </button>

          </div>

        ) : activities.length === 0 ? (

          <div className="rounded-xl border border-white/5 bg-black/20 py-12 text-center">

            <p className="text-sm text-white/50">
              No payment activity yet.
            </p>

            <p className="mt-1 text-xs text-white/30">
              Completed payment requests will appear here.
            </p>

          </div>

        ) : (

          <ActivityTable activities={activities} />

        )}

      </section>

      {/* ====================================================== */}
      {/* SECURITY BOUNDARY                                       */}
      {/* ====================================================== */}

      <section className="rounded-2xl border border-red-900/30 bg-red-950/10 p-6">

        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

          <div>

            <p className="text-xs uppercase tracking-wider text-red-500">
              Security Boundary
            </p>

            <h2 className="mt-2 text-lg font-semibold text-white">
              Spending limits are enforced on-chain
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              The dashboard and AI agent cannot override the
              vault&apos;s allowance, per-transaction cap or
              daily spending limits. Direct over-budget
              contract calls must revert.
            </p>

          </div>

          <div className="shrink-0 rounded-xl border border-red-900/40 bg-black/30 px-5 py-4">

            <div className="flex items-center gap-2">

              <span className="h-2 w-2 rounded-full bg-emerald-400" />

              <span className="text-sm font-medium text-emerald-400">
                ON-CHAIN ENFORCED
              </span>

            </div>

          </div>

        </div>

      </section>

    </div>
  );
}

/* ============================================================ */
/* UI COMPONENTS                                                 */
/* ============================================================ */

function MetricCard({
  title,
  value,
  description,
  status = "default",
}: {
  title: string;
  value: string;
  description: string;
  status?:
  | "default"
  | "success"
  | "warning"
  | "danger";
}) {
  const statusClasses = {
    default: "border-zinc-800",
    success: "border-emerald-900/40",
    warning: "border-amber-900/40",
    danger: "border-red-900/40",
  };

  const valueClasses = {
    default: "text-white",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
  };

  return (
    <div
      className={`rounded-2xl border bg-zinc-950 p-5 transition hover:border-red-900/50 ${statusClasses[status]}`}
    >
      <p className="text-xs uppercase tracking-wider text-zinc-600">
        {title}
      </p>

      <p
        className={`mt-3 text-2xl font-bold ${valueClasses[status]}`}
      >
        {value}
      </p>

      <p className="mt-1 text-xs text-zinc-600">
        {description}
      </p>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-600">
        {label}
      </p>

      <p
        className={`mt-2 text-sm text-white ${mono
            ? "font-mono"
            : "font-medium"
          }`}
      >
        {value}
      </p>
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">

      <h2 className="text-lg font-semibold text-white">
        {title}
      </h2>

      <p className="mt-1 text-sm text-zinc-500">
        {description}
      </p>

    </div>
  );
}

function ProgressPanel({
  title,
  description,
  percentage,
  value,
}: {
  title: string;
  description: string;
  percentage: number;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">

      <div className="flex items-start justify-between gap-4">

        <div>

          <h3 className="text-sm font-semibold text-white">
            {title}
          </h3>

          <p className="mt-1 text-xs text-zinc-600">
            {description}
          </p>

        </div>

        <span className="text-sm font-medium text-zinc-400">
          {percentage.toFixed(0)}%
        </span>

      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">

        <div
          className="h-full rounded-full bg-red-500 transition-all duration-500"
          style={{
            width: `${percentage}%`,
          }}
        />

      </div>

      <p className="mt-3 text-xs text-zinc-500">
        {value}
      </p>

    </div>
  );
}

function RiskRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800/70 pb-3 last:border-0 last:pb-0">

      <span className="text-sm text-zinc-500">
        {label}
      </span>

      <span className="font-mono text-sm text-zinc-600">
        {value}
      </span>

    </div>
  );
}

function ProviderCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">

      <p className="text-xs uppercase tracking-wider text-zinc-600">
        {title}
      </p>

      <p className="mt-2 text-xl font-semibold text-white">
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
        className={`flex items-center gap-2 text-sm font-medium ${active
            ? "text-emerald-400"
            : "text-zinc-500"
          }`}
      >

        <span
          className={`h-2 w-2 rounded-full ${active
              ? "bg-emerald-400"
              : "bg-zinc-600"
            }`}
        />

        {value}

      </span>

    </div>
  );
}