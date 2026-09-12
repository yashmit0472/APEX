"use client";

import { useState } from "react";
import { useTreasuryBalance } from "../../hooks/useTreasuryBalance";
import { MetricCard } from "./MetricCard";
import { DashboardHeader } from "./DashboardHeader";
import { FirewallDecisionCard } from "./FirewallDecisionCard";
import {
    ProviderOverview,
    type ProviderOverviewData,
} from "./ProviderOverview";
import {
    ActivityTable,
    type ActivityItem,
} from "./ActivityTable";
import { TransactionDetails } from "./TransactionDetails";
import { useDashboardData } from "../../hooks/useDashboardData";

function formatUSDC(value: number) {
    return (value / 1_000_000).toLocaleString(
        "en-US",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }
    );
}

function formatAddress(
    address?: string
) {
    if (!address) return "—";

    return `${address.slice(
        0,
        6
    )}...${address.slice(-4)}`;
}

export function DashboardOverview() {
    const dashboard = useDashboardData();

    const treasuryBalance =
        useTreasuryBalance();

    const [selectedActivity, setSelectedActivity] =
        useState<ActivityItem | null>(null);

    /*
     * Phase 10 UI data.
     *
     * Real provider/activity/risk data should be supplied
     * from the Phase 9 Supabase records or your event indexer.
     *
     * The component intentionally keeps those records separate
     * from the on-chain financial state.
     */

    const providers: ProviderOverviewData[] = [];

    const activities: ActivityItem[] = [];

    const latestDecision = {
        decision: "AUTO-PAY" as const,
        score: 0,
        factors: [
            {
                name: "Amount Risk",
                score: 0,
            },
            {
                name: "Budget Risk",
                score: 0,
            },
            {
                name: "Provider Risk",
                score: 0,
            },
            {
                name: "Frequency Risk",
                score: 0,
            },
            {
                name: "Reputation Risk",
                score: 0,
            },
        ],
    };

    const vaultStatus =
        dashboard.paused
            ? "PAUSED"
            : "ACTIVE";

    return (
        <div className="min-h-screen bg-black text-white">
            <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
                <DashboardHeader
                    firewallActive={!dashboard.paused}
                />

                {/* Financial overview */}
                <section className="mt-8">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold">
                            Financial State
                        </h2>

                        <p className="mt-1 text-sm text-white/40">
                            Current on-chain agent spending state
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <MetricCard
                            title="Agent Allowance"
                            value={`$${formatUSDC(
                                dashboard.maxSpend
                            )}`}
                            subtitle="Maximum configured spend"
                            icon="◈"
                        />

                        <MetricCard
                            title="Total Spent"
                            value={`$${formatUSDC(
                                dashboard.totalSpent
                            )}`}
                            subtitle="Lifetime vault spending"
                            icon="↗"
                        />

                        <MetricCard
                            title="Remaining"
                            value={`$${formatUSDC(
                                dashboard.remainingAllowance
                            )}`}
                            subtitle="Available allowance"
                            icon="✓"
                            status={
                                dashboard.remainingAllowance > 0
                                    ? "success"
                                    : "danger"
                            }
                        />

                        <MetricCard
                            title="Spent Today"
                            value={`$${formatUSDC(
                                dashboard.dailySpent
                            )}`}
                            subtitle={`Daily cap $${formatUSDC(
                                dashboard.dailyCap
                            )}`}
                            icon="◷"
                            status={
                                dashboard.dailySpent <
                                    dashboard.dailyCap
                                    ? "success"
                                    : "warning"
                            }
                        />

                        <MetricCard
                            title="Treasury"
                            value={`$${formatUSDC(
                                Number(
                                    treasuryBalance.data?.value ?? 0
                                )
                            )}`}
                            subtitle="Connected treasury balance"
                            icon="◆"
                        />
                    </div>
                </section>

                {/* Limits */}
                <section className="mt-6 grid gap-4 md:grid-cols-3">
                    <MetricCard
                        title="Per Transaction Cap"
                        value={`$${formatUSDC(
                            dashboard.perTxCap
                        )}`}
                    />

                    <MetricCard
                        title="Daily Cap"
                        value={`$${formatUSDC(
                            dashboard.dailyCap
                        )}`}
                    />

                    <MetricCard
                        title="Vault Status"
                        value={vaultStatus}
                        status={
                            dashboard.paused
                                ? "danger"
                                : "success"
                        }
                    />
                </section>

                {/* Agent */}
                <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">
                                Agent
                            </h2>

                            <p className="mt-1 text-sm text-white/40">
                                Authorized autonomous payment executor
                            </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                            <p className="text-xs text-white/40">
                                Agent Address
                            </p>

                            <p className="mt-1 font-mono text-sm">
                                {formatAddress(
                                    dashboard.agent as string
                                )}
                            </p>
                        </div>
                    </div>
                </section>

                {/* Firewall */}
                <section className="mt-6">
                    <FirewallDecisionCard
                        decision={latestDecision.decision}
                        score={latestDecision.score}
                        factors={latestDecision.factors}
                    />
                </section>

                {/* Providers */}
                <section className="mt-6">
                    <ProviderOverview
                        providers={providers}
                    />
                </section>

                {/* Activity */}
                <section className="mt-6">
                    <ActivityTable
                        activities={activities}
                        onSelect={setSelectedActivity}
                    />
                </section>
            </main>

            <TransactionDetails
                activity={selectedActivity}
                onClose={() =>
                    setSelectedActivity(null)
                }
            />
        </div>
    );
}