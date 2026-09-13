"use client";

import type { ActivityItem } from "../../hooks/useActivity";
import type { DemoDecision, DemoEvent } from "../../hooks/useDemoState";

interface AgentReasoningLogProps {
  decisions: DemoDecision[];
  events: DemoEvent[];
  activities?: ActivityItem[];
  mode: "demo" | "real";
}

type LogbookEntry = {
  id: string;
  timestamp: number;
  source: "Agent" | "Event" | "Payment";
  title: string;
  summary: string;
  amount?: number | string | null;
  decision?: string | null;
  riskScore?: number | null;
  status: string;
  details: string[];
};

const STATUS_STYLES: Record<string, string> = {
  paid: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  verified: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  submitted: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  pending: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  blocked: "border-red-500/20 bg-red-500/10 text-red-400",
  failed: "border-red-500/20 bg-red-500/10 text-red-400",
  limit: "border-orange-500/20 bg-orange-500/10 text-orange-400",
  event: "border-zinc-500/20 bg-zinc-500/10 text-zinc-300",
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUSDC(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") {
    return "$0.00";
  }

  const numeric = Number(amount);

  if (!Number.isFinite(numeric)) {
    return "$0.00";
  }

  return `$${numeric.toFixed(2)}`;
}

function formatRawUSDC(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "$0.00";
  }

  return formatUSDC(amount / 1_000_000);
}

function readable(value: string | null | undefined): string {
  if (!value) return "Not recorded";

  return value.replace(/_/g, " ").toUpperCase();
}

function statusStyle(status: string): string {
  const normalized = status.toLowerCase();

  return (
    STATUS_STYLES[normalized] ??
    STATUS_STYLES.event
  );
}

function decisionStatus(outcome: string): string {
  switch (outcome) {
    case "payment_executed":
      return "Paid";
    case "pending_approval":
      return "Pending";
    case "blocked":
      return "Blocked";
    case "spending_limit_hit":
      return "Limit";
    case "job_creation_failed":
      return "Failed";
    default:
      return readable(outcome);
  }
}

function eventDetails(event: DemoEvent): string[] {
  const details: string[] = [];
  const data = event.data ?? {};

  if (typeof data.providerName === "string") {
    details.push(`Provider: ${data.providerName}`);
  } else if (typeof data.provider === "string") {
    details.push(`Provider: ${data.provider}`);
  }

  if (typeof data.amount === "number") {
    details.push(`Amount: ${formatRawUSDC(data.amount)}`);
  }

  if (typeof data.decision === "string") {
    details.push(`Firewall decision: ${readable(data.decision)}`);
  }

  if (typeof data.score === "number") {
    details.push(`Risk score: ${data.score}/100`);
  }

  if (typeof data.jobId === "number") {
    details.push(`Job: #${data.jobId}`);
  }

  if (typeof data.requestId === "string") {
    details.push(`Request: ${data.requestId}`);
  }

  if (event.type === "job_settled" && data.resultData) {
    details.push(`Results received:\n${JSON.stringify(data.resultData, null, 2)}`);
  }

  return details;
}

function buildDemoEntries(
  decisions: DemoDecision[],
  events: DemoEvent[]
): LogbookEntry[] {
  const decisionEntries = decisions.map((decision, index) => ({
    id: `decision-${decision.timestamp}-${index}`,
    timestamp: decision.timestamp,
    source: "Agent" as const,
    title: decision.task.description,
    summary: decision.selectedProvider
      ? `Selected ${decision.selectedProvider.name} for ${decision.task.serviceType}.`
      : `Evaluated ${decision.task.serviceType} task.`,
    amount: decision.task.estimatedCost / 1_000_000,
    decision: decision.firewallDecision,
    riskScore: decision.firewallScore,
    status: decisionStatus(decision.outcome),
    details: decision.reasoning,
  }));

  const eventEntries = events.slice(-40).map((event, index) => ({
    id: `event-${event.id}-${index}`,
    timestamp: event.timestamp,
    source: "Event" as const,
    title: event.message,
    summary: readable(event.type),
    decision:
      typeof event.data?.decision === "string"
        ? event.data.decision
        : null,
    riskScore:
      typeof event.data?.score === "number"
        ? event.data.score
        : null,
    status: "Event",
    details: eventDetails(event),
  }));

  return [...decisionEntries, ...eventEntries].sort(
    (a, b) => b.timestamp - a.timestamp
  );
}

function buildRealEntries(
  activities: ActivityItem[]
): LogbookEntry[] {
  return activities.map((activity, index) => {
    const timestamp = activity.timestamp
      ? Date.parse(activity.timestamp)
      : Date.now() - index;

    const details = [
      `Provider: ${activity.provider || "Not recorded"}`,
      `Amount: ${formatUSDC(activity.amount)}`,
      `Firewall decision: ${readable(activity.decision)}`,
      activity.riskScore === null || activity.riskScore === undefined
        ? "Risk score: Not recorded"
        : `Risk score: ${activity.riskScore}/100`,
      `Delivery status: ${readable(activity.status)}`,
    ];

    if (activity.txHash) {
      details.push(`Transaction: ${activity.txHash}`);
    }

    if (activity.delivery) {
      details.push(`Delivery: ${activity.delivery}`);
    }

    return {
      id: `payment-${activity.id}-${index}`,
      timestamp,
      source: "Payment" as const,
      title: `Payment intent ${activity.id}`,
      summary: "Real-money payment activity recorded by the gateway.",
      amount: activity.amount,
      decision: activity.decision,
      riskScore: activity.riskScore,
      status: readable(activity.status),
      details,
    };
  });
}

export function AgentReasoningLog({
  decisions,
  events,
  activities = [],
  mode,
}: AgentReasoningLogProps) {
  const entries =
    mode === "demo"
      ? buildDemoEntries(decisions, events)
      : buildRealEntries(activities);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-red-500">
            Agent Logbook
          </p>

          <h2 className="mt-1 text-lg font-semibold text-white">
            {mode === "demo"
              ? "Simulation Run Log"
              : "Real Money Run Log"}
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            {mode === "demo"
              ? "Every simulated decision, firewall check and escrow event."
              : "Payment intents, firewall decisions and delivery status from live records."}
          </p>
        </div>

        <span className="inline-flex w-fit rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">
          {entries.length} entries
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center">
          <p className="text-sm text-zinc-500">
            Logbook entries will appear as the agent evaluates and executes payments.
          </p>
        </div>
      ) : (
        <div className="max-h-[620px] space-y-3 overflow-y-auto pr-2 custom-scrollbar">
          {entries.slice(0, 120).map((entry) => (
            <article
              key={entry.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-zinc-600">
                      {formatTime(entry.timestamp)}
                    </span>

                    <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                      {entry.source}
                    </span>

                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusStyle(
                        entry.status
                      )}`}
                    >
                      {entry.status}
                    </span>
                  </div>

                  <h3 className="mt-2 text-sm font-semibold text-white">
                    {entry.title}
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {entry.summary}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-right md:w-[280px]">
                  <MiniMetric
                    label="Amount"
                    value={formatUSDC(entry.amount)}
                  />
                  <MiniMetric
                    label="Firewall"
                    value={readable(entry.decision)}
                  />
                  <MiniMetric
                    label="Risk"
                    value={
                      entry.riskScore === null ||
                      entry.riskScore === undefined
                        ? "N/A"
                        : `${entry.riskScore}/100`
                    }
                  />
                </div>
              </div>

              {entry.details.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
                  {entry.details.map((detail, index) => (
                    <div
                      key={`${entry.id}-detail-${index}`}
                      className="text-xs leading-5 text-zinc-400 whitespace-pre-wrap font-mono bg-black/20 p-2 rounded border border-white/5"
                    >
                      {detail}
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-3 font-mono text-[10px] text-zinc-700">
                {formatDateTime(entry.timestamp)}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-700">
        {label}
      </p>

      <p className="mt-1 truncate text-xs font-medium text-zinc-300">
        {value}
      </p>
    </div>
  );
}
