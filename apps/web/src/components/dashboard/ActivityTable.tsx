"use client";

import type {
  ActivityDecision,
  ActivityItem,
} from "../../hooks/useActivity";

export type {
  ActivityDecision,
  ActivityItem,
} from "../../hooks/useActivity";

interface ActivityTableProps {
  activities: ActivityItem[];
  isLoading?: boolean;
  onSelect?: (activity: ActivityItem) => void;
}

function decisionClass(decision: ActivityDecision) {
  switch (decision) {
    case "AUTO_PAY":
      return "bg-emerald-500/10 text-emerald-400";
    case "FLAG":
      return "bg-amber-500/10 text-amber-400";
    case "REQUIRE_APPROVAL":
      return "bg-orange-500/10 text-orange-400";
    case "BLOCK":
      return "bg-red-500/10 text-red-400";
    default:
      return "bg-white/5 text-white/40";
  }
}

function decisionLabel(decision: ActivityDecision) {
  switch (decision) {
    case "AUTO_PAY":
      return "AUTO PAY";
    case "FLAG":
      return "FLAGGED";
    case "REQUIRE_APPROVAL":
      return "REVIEW";
    case "BLOCK":
      return "BLOCKED";
    default:
      return "N/A";
  }
}

function statusClass(status: ActivityItem["status"]) {
  const normalized = status.toUpperCase();

  switch (normalized) {
    case "VERIFIED":
    case "SETTLED":
      return "text-emerald-400";
    case "FAILED":
    case "REFUNDED":
      return "text-red-400";
    case "PENDING":
    case "SUBMITTED":
      return "text-amber-400";
    default:
      return "text-white/40";
  }
}

function shortHash(hash?: string | null) {
  if (!hash) return "N/A";

  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function formatAmount(amount: number) {
  if (!Number.isFinite(amount)) {
    return "$0.00";
  }

  return `$${amount.toFixed(2)}`;
}

export function ActivityTable({
  activities,
  isLoading = false,
  onSelect,
}: ActivityTableProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/10 p-6">
        <h2 className="text-lg font-semibold">
          Recent Activity
        </h2>

        <p className="mt-1 text-sm text-white/40">
          Payments, firewall decisions and delivery status
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="border-b border-white/10 text-xs text-white/40">
              <th className="px-6 py-4 font-medium">Provider</th>
              <th className="px-6 py-4 font-medium">Amount</th>
              <th className="px-6 py-4 font-medium">Decision</th>
              <th className="px-6 py-4 font-medium">Risk</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Time</th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-10 text-center text-sm text-white/40"
                >
                  Loading activity...
                </td>
              </tr>
            ) : activities.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-10 text-center text-sm text-white/40"
                >
                  No payment activity yet.
                </td>
              </tr>
            ) : (
              activities.map((activity) => (
                <tr
                  key={activity.id}
                  onClick={() => onSelect?.(activity)}
                  className={`border-b border-white/5 transition hover:bg-white/[0.03] ${
                    onSelect ? "cursor-pointer" : ""
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">
                      {activity.provider || "N/A"}
                    </div>

                    {activity.txHash && (
                      <div className="mt-1 font-mono text-xs text-white/25">
                        {shortHash(activity.txHash)}
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4 font-medium text-white">
                    {formatAmount(activity.amount)}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${decisionClass(
                        activity.decision
                      )}`}
                    >
                      {decisionLabel(activity.decision)}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    {activity.riskScore === null ? (
                      <span className="text-sm text-white/30">
                        N/A
                      </span>
                    ) : (
                      <span className="font-mono text-sm text-white">
                        {activity.riskScore}
                        <span className="text-white/30">/100</span>
                      </span>
                    )}
                  </td>

                  <td
                    className={`px-6 py-4 text-sm font-medium ${statusClass(
                      activity.status
                    )}`}
                  >
                    {activity.status || "UNKNOWN"}
                  </td>

                  <td className="px-6 py-4 text-sm text-white/40">
                    {activity.timestamp ?? "N/A"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
