/**
 * Demo Logger
 *
 * Logs simulation events to Supabase so the existing
 * dashboard activity table shows live demo data.
 *
 * Uses the existing Phase9 schema tables:
 *  - activity_events
 *  - payment_intents
 *  - firewall_events
 *  - escrow_jobs
 *  - payment_transactions
 */

import { simulator } from "./simulator.js";

// ── Types ──────────────────────────────────────────────

interface ActivityEvent {
  event_type: string;
  actor_address: string | null;
  request_id: string | null;
  job_id?: number | null;
  metadata: Record<string, unknown>;
}

// ── Supabase Client (lazy init) ────────────────────────

let supabaseUrl: string | null = null;
let supabaseKey: string | null = null;

function initSupabase(): void {
  supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    null;

  supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    null;

  if (supabaseUrl && supabaseKey) {
    console.log(
      "[demo-logger] Supabase logging enabled"
    );
  } else {
    console.log(
      "[demo-logger] Supabase not configured — logging to console only"
    );
  }
}

async function supabaseInsert(
  table: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!supabaseUrl || !supabaseKey) return;

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${table}`,
      {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `[demo-logger] Supabase insert to ${table} failed:`,
        text
      );
    }
  } catch (error) {
    console.error(
      `[demo-logger] Supabase insert error:`,
      error
    );
  }
}

// ── Public API ─────────────────────────────────────────

let initialized = false;

export function logDemoEvent(event: ActivityEvent): void {
  if (!initialized) {
    initSupabase();
    initialized = true;
  }

  // Always log to console
  console.log(
    `[demo] ${event.event_type}: ${JSON.stringify(event.metadata)}`
  );

  // Insert into Supabase activity_events
  supabaseInsert("activity_events", {
    event_type: event.event_type,
    actor_address: event.actor_address,
    request_id: event.request_id,
    job_id: event.job_id ?? null,
    metadata: event.metadata,
  });
}

/**
 * Log a complete payment intent to Supabase.
 */
export function logPaymentIntent(params: {
  requestId: string;
  agent: string;
  provider: string;
  amount: number;
  serviceId: string;
  deadline: number;
  nonce: number;
  stakeRequired: number;
  riskScore: number | null;
  firewallDecision: string | null;
  status: string;
}): void {
  if (!initialized) {
    initSupabase();
    initialized = true;
  }

  supabaseInsert("payment_intents", {
    request_id: params.requestId,
    agent_address: params.agent,
    provider_address: params.provider,
    amount: params.amount.toString(),
    service_id: params.serviceId,
    deadline: new Date(params.deadline).toISOString(),
    nonce: params.nonce.toString(),
    stake_required: params.stakeRequired.toString(),
    risk_score: params.riskScore,
    firewall_decision: params.firewallDecision,
    status: params.status,
  });
}

/**
 * Log a firewall evaluation event.
 */
export function logFirewallEvent(params: {
  requestId: string;
  agent: string;
  provider: string;
  amount: number;
  riskScore: number;
  decision: string;
}): void {
  if (!initialized) {
    initSupabase();
    initialized = true;
  }

  supabaseInsert("firewall_events", {
    request_id: params.requestId,
    agent_address: params.agent,
    provider_address: params.provider,
    amount: params.amount.toString(),
    risk_score: params.riskScore,
    decision: params.decision,
    status: "evaluated",
  });
}

/**
 * Log an escrow job.
 */
export function logEscrowJob(params: {
  jobId: number;
  requestId: string;
  agent: string;
  provider: string;
  amount: number;
  stakeRequired: number;
  deadline: number;
  serviceId: string;
  status: string;
}): void {
  if (!initialized) {
    initSupabase();
    initialized = true;
  }

  supabaseInsert("escrow_jobs", {
    job_id: params.jobId.toString(),
    request_id: params.requestId,
    agent_address: params.agent,
    provider_address: params.provider,
    amount: params.amount.toString(),
    stake_required: params.stakeRequired.toString(),
    deadline: new Date(params.deadline).toISOString(),
    service_id: params.serviceId,
    status: params.status,
    funded_at: new Date().toISOString(),
  });
}

/**
 * Attach simulator event listener to auto-log
 * all events to Supabase.
 */
export function attachSimulatorLogger(): void {
  if (!initialized) {
    initSupabase();
    initialized = true;
  }

  simulator.addEventListener((event) => {
    logDemoEvent({
      event_type: event.type,
      actor_address:
        (event.data.provider as string) ??
        simulator.agentAddress,
      request_id:
        (event.data.requestId as string) ?? null,
      job_id:
        (event.data.jobId as number) ?? null,
      metadata: event.data,
    });

    // Also log specific types to their tables
    if (event.type === "firewall_evaluated") {
      logFirewallEvent({
        requestId:
          event.data.requestId as string,
        agent: simulator.agentAddress,
        provider: event.data.provider as string,
        amount:
          (event.data.amount as number) ?? 0,
        riskScore:
          event.data.score as number,
        decision:
          event.data.decision as string,
      });
    }
  });

  console.log(
    "[demo-logger] Attached to simulator event stream"
  );
}
