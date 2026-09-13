/**
 * Demo Agent
 *
 * An autonomous agent that periodically:
 * 1. Picks a task from the queue
 * 2. Searches for eligible providers
 * 3. Selects the best provider (highest stake, matching service)
 * 4. Evaluates risk through the firewall
 * 5. Executes payment if AUTO_PAY or FLAG
 * 6. Flags for human approval if REQUIRE_APPROVAL
 * 7. Aborts if BLOCK
 *
 * This is a rule-based autonomous agent that demonstrates
 * real decision-making without needing an LLM.
 */

import { simulator, type SimProvider, type SimJob } from "./simulator.js";
import {
  simulateProviderWork,
  startProviderSimulation,
  stopProviderSimulation,
} from "./demo-providers.js";
import { logDemoEvent } from "./demo-logger.js";
import type { SeedTask } from "../config/demo-seed.js";

let agentInterval: ReturnType<typeof setInterval> | null = null;
let running = false;
let speedMs = 5000; // ms between agent decisions

export interface AgentDecision {
  timestamp: number;
  task: SeedTask;
  reasoning: string[];
  selectedProvider: SimProvider | null;
  firewallScore: number | null;
  firewallDecision: string | null;
  outcome: string;
  jobId: number | null;
}

let decisions: AgentDecision[] = [];

/**
 * Start the autonomous demo agent loop.
 */
export function startDemoAgent(speed?: number): void {
  if (running) return;

  if (speed) speedMs = speed;

  running = true;

  startProviderSimulation();

  console.log(
    `[demo-agent] Agent started (interval: ${speedMs}ms)`
  );

  // Run first tick immediately
  agentTick();

  agentInterval = setInterval(() => {
    if (running) agentTick();
  }, speedMs);
}

/**
 * Stop the autonomous demo agent.
 */
export function stopDemoAgent(): void {
  running = false;

  if (agentInterval) {
    clearInterval(agentInterval);
    agentInterval = null;
  }

  stopProviderSimulation();

  console.log("[demo-agent] Agent stopped");
}

/**
 * Check if the agent is running.
 */
export function isDemoAgentRunning(): boolean {
  return running;
}

/**
 * Get the agent's decision history.
 */
export function getDecisions(): AgentDecision[] {
  return decisions;
}

/**
 * Set the agent's decision speed.
 */
export function setAgentSpeed(ms: number): void {
  speedMs = ms;

  if (running && agentInterval) {
    clearInterval(agentInterval);
    agentInterval = setInterval(() => {
      if (running) agentTick();
    }, speedMs);
  }
}

/**
 * One tick of the agent's decision loop.
 */
function agentTick(): void {
  if (!running) return;

  const task = pickNextTask();

  if (!task) {
    simulator.events.push({
      id: Math.random().toString(36).slice(2),
      timestamp: Date.now(),
      type: "agent_idle",
      message: "No tasks remaining in queue — agent idle",
      data: {},
    });
    return;
  }

  const decision = executeTask(task);
  decisions.push(decision);

  // Keep only last 100 decisions
  if (decisions.length > 100) {
    decisions = decisions.slice(-100);
  }

  // Log to Supabase
  logDemoEvent({
    event_type: "agent_decision",
    actor_address: simulator.agentAddress,
    request_id: decision.jobId?.toString() ?? null,
    metadata: {
      task: task.id,
      description: task.description,
      reasoning: decision.reasoning,
      outcome: decision.outcome,
      firewallScore: decision.firewallScore,
      firewallDecision: decision.firewallDecision,
      providerName: decision.selectedProvider?.name ?? null,
    },
  });
}

/**
 * Pick the next task using priority ordering.
 * High priority tasks are picked first, then medium, then low.
 */
function pickNextTask(): SeedTask | null {
  const queue = simulator.taskQueue;

  if (queue.length === 0) return null;

  // Sort by priority: high > medium > low
  const priorityOrder = { high: 0, medium: 1, low: 2 };

  queue.sort(
    (a, b) =>
      priorityOrder[a.priority] -
      priorityOrder[b.priority]
  );

  return queue[0];
}

/**
 * Execute a task through the full APEX pipeline.
 */
function executeTask(task: SeedTask): AgentDecision {
  const reasoning: string[] = [];

  reasoning.push(
    `📋 Task: ${task.description} [${task.priority} priority]`
  );

  reasoning.push(
    `💰 Estimated cost: ${simulator._formatUSDC(task.estimatedCost)}`
  );

  // Step 1: Find providers for this service type
  const candidates = simulator.getProvidersByService(
    task.serviceType
  );

  reasoning.push(
    `🔍 Found ${candidates.length} provider(s) offering ${task.serviceType}`
  );

  if (candidates.length === 0) {
    reasoning.push(
      `❌ No providers available for ${task.serviceType} — skipping task`
    );

    // Move task to back of queue instead of removing
    const idx = simulator.taskQueue.indexOf(task);
    if (idx !== -1) {
      simulator.taskQueue.splice(idx, 1);
      simulator.taskQueue.push(task);
    }

    return {
      timestamp: Date.now(),
      task,
      reasoning,
      selectedProvider: null,
      firewallScore: null,
      firewallDecision: null,
      outcome: "no_providers",
      jobId: null,
    };
  }

  // Step 2: Filter for eligible providers
  const eligible = candidates.filter((p) =>
    simulator.isEligible(p.address)
  );

  reasoning.push(
    `✅ ${eligible.length} provider(s) meet eligibility requirements`
  );

  if (eligible.length === 0) {
    reasoning.push(
      `❌ No eligible providers (need registration + active + minimum stake) — skipping`
    );

    const idx = simulator.taskQueue.indexOf(task);
    if (idx !== -1) {
      simulator.taskQueue.splice(idx, 1);
      simulator.taskQueue.push(task);
    }

    return {
      timestamp: Date.now(),
      task,
      reasoning,
      selectedProvider: null,
      firewallScore: null,
      firewallDecision: null,
      outcome: "no_eligible_providers",
      jobId: null,
    };
  }

  // Step 3: Select the best provider
  // Strategy: prefer higher available stake (more collateral = more trustworthy)
  const ranked = [...eligible].sort((a, b) => {
    const aStake = simulator.availableStake(a.address);
    const bStake = simulator.availableStake(b.address);
    return bStake - aStake;
  });

  const selected = ranked[0];

  reasoning.push(
    `🏆 Selected: ${selected.name} (${selected.address.slice(0, 6)}...${selected.address.slice(-4)}) — available stake: ${simulator._formatUSDC(simulator.availableStake(selected.address))}`
  );

  // Step 4: Validate spending limits
  const spendCheck = simulator.validateSpending(
    task.estimatedCost
  );

  if (!spendCheck.valid) {
    reasoning.push(
      `🚫 Spending validation failed: ${spendCheck.reason}`
    );

    // Don't remove from queue — might be possible later when daily resets
    const idx = simulator.taskQueue.indexOf(task);
    if (idx !== -1) {
      simulator.taskQueue.splice(idx, 1);
      simulator.taskQueue.push(task);
    }

    return {
      timestamp: Date.now(),
      task,
      reasoning,
      selectedProvider: selected,
      firewallScore: null,
      firewallDecision: null,
      outcome: "spending_limit_hit",
      jobId: null,
    };
  }

  reasoning.push(`✅ Spending validation passed`);

  // Step 5: Evaluate through the firewall
  const requestId = simulator.generateRequestId();

  const firewallResult = simulator.evaluateRisk(
    simulator.agentAddress,
    selected.address,
    task.estimatedCost,
    requestId
  );

  reasoning.push(
    `🛡️ Firewall score: ${firewallResult.score}/100 → ${firewallResult.decision}`
  );

  reasoning.push(
    `   Amount risk: ${firewallResult.breakdown.amountRisk}, ` +
      `Stake risk: ${firewallResult.breakdown.stakeRisk}, ` +
      `Frequency risk: ${firewallResult.breakdown.frequencyRisk}, ` +
      `First-payment risk: ${firewallResult.breakdown.firstPaymentRisk}`
  );

  // Step 6: Act on firewall decision
  if (firewallResult.decision === "BLOCK") {
    reasoning.push(
      `🚨 BLOCKED by firewall — payment not executed`
    );

    // Remove from queue — the task is effectively rejected
    const idx = simulator.taskQueue.indexOf(task);
    if (idx !== -1) {
      simulator.taskQueue.splice(idx, 1);
    }

    return {
      timestamp: Date.now(),
      task,
      reasoning,
      selectedProvider: selected,
      firewallScore: firewallResult.score,
      firewallDecision: firewallResult.decision,
      outcome: "blocked",
      jobId: null,
    };
  }

  if (firewallResult.decision === "REQUIRE_APPROVAL") {
    reasoning.push(
      `⏳ Requires human approval — payment pending`
    );

    // Don't remove from queue yet — will be retried if approved
    // In a real demo, a human would approve this
    // For auto-demo, auto-approve after a delay
    setTimeout(() => {
      simulator.approveRequest(requestId);
      // Re-execute the task
      if (running) {
        executeApprovedPayment(task, selected, requestId);
      }
    }, 3000 + Math.random() * 5000);

    return {
      timestamp: Date.now(),
      task,
      reasoning,
      selectedProvider: selected,
      firewallScore: firewallResult.score,
      firewallDecision: firewallResult.decision,
      outcome: "pending_approval",
      jobId: null,
    };
  }

  if (firewallResult.decision === "FLAG") {
    reasoning.push(
      `⚠️ Flagged but proceeding with payment`
    );
  } else {
    reasoning.push(`✅ AUTO_PAY — proceeding`);
  }

  // Step 7: Execute payment
  return executePaymentForTask(
    task,
    selected,
    requestId,
    reasoning,
    firewallResult.score,
    firewallResult.decision
  );
}

/**
 * Execute payment after approval.
 */
function executeApprovedPayment(
  task: SeedTask,
  provider: SimProvider,
  _requestId: string
): void {
  const reasoning = [
    `✅ Human approval received for ${task.description}`,
    `Proceeding with payment to ${provider.name}`,
  ];

  executePaymentForTask(
    task,
    provider,
    _requestId,
    reasoning,
    null,
    "REQUIRE_APPROVAL"
  );
}

/**
 * Create the escrow job and trigger provider work simulation.
 */
function executePaymentForTask(
  task: SeedTask,
  provider: SimProvider,
  _requestId: string,
  reasoning: string[],
  firewallScore: number | null,
  firewallDecision: string | null
): AgentDecision {
  const deadline =
    Date.now() + 60 * 1000; // 60 second deadline

  const job = simulator.createJob(
    provider.address,
    task.estimatedCost,
    task.stakeRequired,
    deadline,
    task.serviceType,
    task.description
  );

  if (!job) {
    reasoning.push(
      `❌ Job creation failed — check vault balance and policy`
    );

    return {
      timestamp: Date.now(),
      task,
      reasoning,
      selectedProvider: provider,
      firewallScore,
      firewallDecision,
      outcome: "job_creation_failed",
      jobId: null,
    };
  }

  reasoning.push(
    `🎉 Job #${job.jobId} created — ${simulator._formatUSDC(task.estimatedCost)} escrowed`
  );

  // Remove task from queue, add to completed
  const idx = simulator.taskQueue.indexOf(task);
  if (idx !== -1) {
    simulator.taskQueue.splice(idx, 1);
    simulator.completedTasks.push(task);
  }

  // Trigger provider work simulation
  simulateProviderWork(job);

  reasoning.push(
    `⏳ Waiting for ${provider.name} to deliver...`
  );

  // Log to Supabase
  logDemoEvent({
    event_type: "payment_executed",
    actor_address: simulator.agentAddress,
    request_id: _requestId,
    job_id: job.jobId,
    metadata: {
      provider: provider.address,
      providerName: provider.name,
      amount: task.estimatedCost,
      serviceType: task.serviceType,
      taskDescription: task.description,
      firewallScore,
      firewallDecision,
    },
  });

  return {
    timestamp: Date.now(),
    task,
    reasoning,
    selectedProvider: provider,
    firewallScore,
    firewallDecision,
    outcome: "payment_executed",
    jobId: job.jobId,
  };
}
