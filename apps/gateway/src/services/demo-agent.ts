/**
 * Demo Agent
 *
 * An interactive agent that:
 * 1. Takes a prompt from the user
 * 2. Determines the required service and cost
 * 3. Selects the best provider
 * 4. Evaluates risk through the firewall
 * 5. Executes payment and waits for provider delivery
 */

import { simulator, type SimProvider, type SimJob } from "./simulator.js";
import { simulateProviderWork } from "./demo-providers.js";
import { logDemoEvent } from "./demo-logger.js";
import type { SeedTask } from "../config/demo-seed.js";

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
 * Get the agent's decision history.
 */
export function getDecisions(): AgentDecision[] {
  return decisions;
}

/**
 * Process a user prompt, deduce the required task, and execute the payment flow.
 */
export function processPrompt(prompt: string): AgentDecision {
  const lowerPrompt = prompt.toLowerCase();
  
  let serviceType = "LLM_INFERENCE";
  let estimatedCost = 5_000_000; // 5 USDC
  let stakeRequired = 0;
  
  if (lowerPrompt.includes("gpu") || lowerPrompt.includes("render") || lowerPrompt.includes("train")) {
    serviceType = "GPU_COMPUTE";
    estimatedCost = 15_000_000;
    stakeRequired = 50_000_000;
  } else if (lowerPrompt.includes("data") || lowerPrompt.includes("dataset") || lowerPrompt.includes("market") || lowerPrompt.includes("price")) {
    serviceType = "DATA_API";
    estimatedCost = 10_000_000;
    stakeRequired = 20_000_000;
  } else if (lowerPrompt.includes("research") || lowerPrompt.includes("search") || lowerPrompt.includes("web") || lowerPrompt.includes("find")) {
    serviceType = "WEB_RESEARCH";
    estimatedCost = 8_000_000;
    stakeRequired = 10_000_000;
  } else if (lowerPrompt.includes("storage") || lowerPrompt.includes("store") || lowerPrompt.includes("backup")) {
    serviceType = "STORAGE";
    estimatedCost = 6_000_000;
    stakeRequired = 30_000_000;
  }

  const task: SeedTask = {
    id: `task-prompt-${Date.now()}`,
    description: prompt,
    serviceType,
    estimatedCost,
    priority: "high",
    stakeRequired,
  };

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

  return decision;
}

/**
 * Execute a task through the full APEX pipeline.
 */
function executeTask(task: SeedTask): AgentDecision {
  const reasoning: string[] = [];

  reasoning.push(
    `Received Prompt: "${task.description}"`
  );
  
  reasoning.push(
    `Analysis: Requires ${task.serviceType} access`
  );

  reasoning.push(
    `Estimated cost: ${simulator._formatUSDC(task.estimatedCost)}`
  );

  // Step 1: Find providers for this service type
  const candidates = simulator.getProvidersByService(
    task.serviceType
  );

  reasoning.push(
    `Found ${candidates.length} provider(s) offering ${task.serviceType}`
  );

  if (candidates.length === 0) {
    reasoning.push(
      `No providers available for ${task.serviceType} — aborting`
    );

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
    `${eligible.length} provider(s) meet eligibility requirements`
  );

  if (eligible.length === 0) {
    reasoning.push(
      `No eligible providers (need registration + active + minimum stake) — aborting`
    );

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
    `Selected: ${selected.name} (${selected.address.slice(0, 6)}...${selected.address.slice(-4)}) — available stake: ${simulator._formatUSDC(simulator.availableStake(selected.address))}`
  );

  // Step 4: Validate spending limits
  const spendCheck = simulator.validateSpending(
    task.estimatedCost
  );

  if (!spendCheck.valid) {
    reasoning.push(
      `Spending validation failed: ${spendCheck.reason}`
    );

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

  reasoning.push(`Spending validation passed`);

  // Step 5: Evaluate through the firewall
  const requestId = simulator.generateRequestId();

  const firewallResult = simulator.evaluateRisk(
    simulator.agentAddress,
    selected.address,
    task.estimatedCost,
    requestId
  );

  reasoning.push(
    `Firewall score: ${firewallResult.score}/100 → ${firewallResult.decision}`
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
      `BLOCKED by firewall — payment not executed`
    );

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
      `Requires human approval — payment pending`
    );

    setTimeout(() => {
      simulator.approveRequest(requestId);
      executeApprovedPayment(task, selected, requestId);
    }, 3000);

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
      `Flagged but proceeding with payment`
    );
  } else {
    reasoning.push(`AUTO_PAY — proceeding`);
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
    `Human approval received for ${task.description}`,
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
      `Job creation failed — check vault balance and policy`
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
    `Job #${job.jobId} created — ${simulator._formatUSDC(task.estimatedCost)} escrowed`
  );

  // Trigger provider work simulation
  simulateProviderWork(job);

  reasoning.push(
    `Waiting for ${provider.name} to deliver...`
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
