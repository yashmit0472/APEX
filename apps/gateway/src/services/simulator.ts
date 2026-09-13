/**
 * APEX Simulation Engine
 *
 * Replicates all on-chain contract logic using in-memory state.
 * This is the heart of demo mode — every function mirrors its
 * Solidity counterpart exactly.
 */

import { createHash, randomBytes } from "crypto";

import {
  DEMO_PROVIDERS,
  DEMO_AGENT,
  DEMO_TASKS,
  FIREWALL_POLICY,
  MINIMUM_STAKE,
  type SeedProvider,
  type SeedTask,
} from "../config/demo-seed.js";

// ── Types ──────────────────────────────────────────────

export type JobStatus =
  | "Funded"
  | "WorkSubmitted"
  | "Settled"
  | "Refunded"
  | "Cancelled";

export type FirewallDecision =
  | "AUTO_PAY"
  | "FLAG"
  | "REQUIRE_APPROVAL"
  | "BLOCK";

export type PendingStatus =
  | "None"
  | "Pending"
  | "Approved"
  | "Rejected";

export interface SimProvider {
  address: `0x${string}`;
  name: string;
  serviceType: string;
  endpoint: string;
  registered: boolean;
  active: boolean;
  stakedBalance: number;
  lockedBalance: number;
  reliability: number;
  registeredAt: number;
}

export interface SimJob {
  jobId: number;
  agent: `0x${string}`;
  provider: `0x${string}`;
  amount: number;
  stakeRequired: number;
  createdAt: number;
  deadline: number;
  deliveryAt: number;
  serviceId: string;
  deliveryHash: string;
  status: JobStatus;
  taskDescription: string;
}

export interface SimFirewallResult {
  requestId: string;
  score: number;
  decision: FirewallDecision;
  breakdown: {
    amountRisk: number;
    stakeRisk: number;
    frequencyRisk: number;
    firstPaymentRisk: number;
  };
}

export interface SimPendingRequest {
  requestId: string;
  agent: `0x${string}`;
  provider: `0x${string}`;
  amount: number;
  score: number;
  timestamp: number;
  status: PendingStatus;
}

export interface AgentPolicy {
  maxSpend: number;
  perTxCap: number;
  dailyCap: number;
  expiresAt: number;
  authorized: boolean;
}

export interface SimEvent {
  id: string;
  timestamp: number;
  type: string;
  message: string;
  data: Record<string, unknown>;
}

// ── Simulation Engine ──────────────────────────────────

export class SimulationEngine {
  // Provider state
  providers: Map<string, SimProvider> = new Map();

  // Agent state
  agentAddress: `0x${string}`;
  agentPolicy: AgentPolicy;
  vaultBalance: number;
  totalSpent: number = 0;
  dailySpent: number = 0;
  dailyWindowStart: number = Date.now();

  // Escrow state
  jobs: Map<number, SimJob> = new Map();
  nextJobId: number = 0;

  // Firewall state
  pendingRequests: Map<string, SimPendingRequest> = new Map();
  providerRequestTimes: Map<string, number[]> = new Map();
  hasSuccessfulPayment: Map<string, Set<string>> = new Map();

  // Task queue
  taskQueue: SeedTask[] = [];
  completedTasks: SeedTask[] = [];

  // Nonce tracking
  nonce: number = 0;

  // Treasury
  treasuryBalance: number = 0;

  // Event log
  events: SimEvent[] = [];
  private eventListeners: Array<(event: SimEvent) => void> = [];

  constructor() {
    this.agentAddress = DEMO_AGENT.address;
    this.agentPolicy = {
      ...DEMO_AGENT.policy,
      authorized: true,
    };
    this.vaultBalance = DEMO_AGENT.initialBalance;

    this._seedProviders();
    this._seedTasks();
  }

  // ── Initialization ─────────────────────────────────

  private _seedProviders(): void {
    for (const seed of DEMO_PROVIDERS) {
      const provider: SimProvider = {
        address: seed.address,
        name: seed.name,
        serviceType: seed.serviceType,
        endpoint: seed.endpoint,
        registered: true,
        active: true,
        stakedBalance: seed.stakeAmount,
        lockedBalance: 0,
        reliability: seed.reliability,
        registeredAt: Date.now(),
      };

      this.providers.set(
        seed.address.toLowerCase(),
        provider
      );

      this.providerRequestTimes.set(
        seed.address.toLowerCase(),
        []
      );
    }

    this._emit("system", "Simulation initialized with providers", {
      providerCount: DEMO_PROVIDERS.length,
      providers: DEMO_PROVIDERS.map((p) => ({
        name: p.name,
        serviceType: p.serviceType,
        address: p.address,
      })),
    });
  }

  private _seedTasks(): void {
    this.taskQueue = [...DEMO_TASKS];
    this._emit("system", `Task queue loaded with ${this.taskQueue.length} tasks`, {
      taskCount: this.taskQueue.length,
    });
  }

  // ── Reset ──────────────────────────────────────────

  reset(): void {
    this.providers.clear();
    this.jobs.clear();
    this.pendingRequests.clear();
    this.providerRequestTimes.clear();
    this.hasSuccessfulPayment.clear();
    this.taskQueue = [];
    this.completedTasks = [];
    this.events = [];
    this.nextJobId = 0;
    this.nonce = 0;
    this.totalSpent = 0;
    this.dailySpent = 0;
    this.dailyWindowStart = Date.now();
    this.treasuryBalance = 0;
    this.vaultBalance = DEMO_AGENT.initialBalance;
    this.agentPolicy = {
      ...DEMO_AGENT.policy,
      authorized: true,
    };

    this._seedProviders();
    this._seedTasks();

    this._emit("system", "Simulation reset to initial state", {});
  }

  // ── Provider Registry (mirrors ProviderRegistry.sol) ──

  isRegistered(provider: string): boolean {
    const p = this.providers.get(provider.toLowerCase());
    return p?.registered ?? false;
  }

  isActive(provider: string): boolean {
    const p = this.providers.get(provider.toLowerCase());
    return (p?.registered && p?.active) ?? false;
  }

  getProvider(provider: string): SimProvider | undefined {
    return this.providers.get(provider.toLowerCase());
  }

  getProvidersByService(serviceType: string): SimProvider[] {
    const result: SimProvider[] = [];

    for (const p of this.providers.values()) {
      if (
        p.serviceType === serviceType &&
        p.registered &&
        p.active
      ) {
        result.push(p);
      }
    }

    return result;
  }

  // ── Stake Manager (mirrors StakeManager.sol) ───────

  availableStake(provider: string): number {
    const p = this.providers.get(provider.toLowerCase());

    if (!p) return 0;

    return p.stakedBalance - p.lockedBalance;
  }

  isEligible(provider: string): boolean {
    const p = this.providers.get(provider.toLowerCase());

    if (!p) return false;
    if (!p.registered) return false;
    if (!p.active) return false;
    if (p.stakedBalance < MINIMUM_STAKE) return false;

    return true;
  }

  lockStake(provider: string, amount: number): boolean {
    const p = this.providers.get(provider.toLowerCase());

    if (!p) return false;

    const available = p.stakedBalance - p.lockedBalance;

    if (amount > available) return false;

    p.lockedBalance += amount;

    this._emit(
      "stake_locked",
      `Locked ${this._formatUSDC(amount)} stake for ${p.name}`,
      { provider: p.address, amount }
    );

    return true;
  }

  unlockStake(provider: string, amount: number): boolean {
    const p = this.providers.get(provider.toLowerCase());

    if (!p) return false;
    if (amount > p.lockedBalance) return false;

    p.lockedBalance -= amount;

    this._emit(
      "stake_unlocked",
      `Unlocked ${this._formatUSDC(amount)} stake for ${p.name}`,
      { provider: p.address, amount }
    );

    return true;
  }

  slashLocked(
    provider: string,
    amount: number
  ): boolean {
    const p = this.providers.get(provider.toLowerCase());

    if (!p) return false;
    if (amount > p.lockedBalance) return false;

    p.lockedBalance -= amount;
    p.stakedBalance -= amount;
    this.treasuryBalance += amount;

    this._emit(
      "stake_slashed",
      `Slashed ${this._formatUSDC(amount)} from ${p.name} → treasury`,
      { provider: p.address, amount }
    );

    return true;
  }

  // ── Agent Spending Vault (mirrors AgentSpendingVault.sol) ──

  remainingAllowance(): number {
    if (this.totalSpent >= this.agentPolicy.maxSpend) return 0;
    return this.agentPolicy.maxSpend - this.totalSpent;
  }

  remainingDailyAllowance(): number {
    this._resetDailyWindowIfNeeded();

    if (this.dailySpent >= this.agentPolicy.dailyCap) return 0;
    return this.agentPolicy.dailyCap - this.dailySpent;
  }

  private _resetDailyWindowIfNeeded(): void {
    const oneDay = 24 * 60 * 60 * 1000;

    if (Date.now() >= this.dailyWindowStart + oneDay) {
      this.dailyWindowStart = Date.now();
      this.dailySpent = 0;
    }
  }

  validateSpending(amount: number): {
    valid: boolean;
    reason?: string;
  } {
    if (!this.agentPolicy.authorized) {
      return { valid: false, reason: "Agent not authorized" };
    }

    if (Date.now() >= this.agentPolicy.expiresAt) {
      return { valid: false, reason: "Authorization expired" };
    }

    this._resetDailyWindowIfNeeded();

    if (amount > this.agentPolicy.perTxCap) {
      return {
        valid: false,
        reason: `Per-tx cap exceeded: ${this._formatUSDC(amount)} > ${this._formatUSDC(this.agentPolicy.perTxCap)}`,
      };
    }

    if (this.totalSpent + amount > this.agentPolicy.maxSpend) {
      return {
        valid: false,
        reason: `Total cap exceeded: ${this._formatUSDC(this.totalSpent + amount)} > ${this._formatUSDC(this.agentPolicy.maxSpend)}`,
      };
    }

    if (this.dailySpent + amount > this.agentPolicy.dailyCap) {
      return {
        valid: false,
        reason: `Daily cap exceeded: ${this._formatUSDC(this.dailySpent + amount)} > ${this._formatUSDC(this.agentPolicy.dailyCap)}`,
      };
    }

    if (amount > this.vaultBalance) {
      return {
        valid: false,
        reason: `Insufficient vault balance: ${this._formatUSDC(amount)} > ${this._formatUSDC(this.vaultBalance)}`,
      };
    }

    return { valid: true };
  }

  // ── Firewall (mirrors PaymentFirewall.sol exactly) ──

  evaluateRisk(
    agent: string,
    provider: string,
    amount: number,
    requestId: string
  ): SimFirewallResult {
    const MAX_SCORE = 100;
    const policy = FIREWALL_POLICY;

    // Amount risk — mirrors _amountRisk()
    const amountRisk = this._amountRisk(amount, MAX_SCORE);

    // Stake risk — mirrors _stakeRisk()
    const stakeRisk = this._stakeRisk(provider, amount, MAX_SCORE);

    // Frequency risk — mirrors _frequencyRisk()
    const frequencyRisk = this._frequencyRisk(provider, MAX_SCORE);

    // First payment risk
    const agentKey = agent.toLowerCase();
    const providerKey = provider.toLowerCase();
    const agentPayments = this.hasSuccessfulPayment.get(agentKey);
    const firstPaymentRisk =
      agentPayments && agentPayments.has(providerKey)
        ? 0
        : MAX_SCORE;

    const totalWeight =
      policy.amountWeight +
      policy.stakeWeight +
      policy.frequencyWeight +
      policy.firstPaymentWeight;

    const score = Math.floor(
      (amountRisk * policy.amountWeight +
        stakeRisk * policy.stakeWeight +
        frequencyRisk * policy.frequencyWeight +
        firstPaymentRisk * policy.firstPaymentWeight) /
        totalWeight
    );

    const decision = this._decisionFor(score);

    // Record request time
    const times =
      this.providerRequestTimes.get(providerKey) ?? [];
    times.push(Date.now());
    this.providerRequestTimes.set(providerKey, times);

    // Store pending request if REQUIRE_APPROVAL
    if (decision === "REQUIRE_APPROVAL") {
      this.pendingRequests.set(requestId, {
        requestId,
        agent: agent as `0x${string}`,
        provider: provider as `0x${string}`,
        amount,
        score,
        timestamp: Date.now(),
        status: "Pending",
      });
    }

    const result: SimFirewallResult = {
      requestId,
      score,
      decision,
      breakdown: {
        amountRisk,
        stakeRisk,
        frequencyRisk,
        firstPaymentRisk,
      },
    };

    this._emit(
      "firewall_evaluated",
      `Firewall evaluated request: score=${score} → ${decision}`,
      {
        ...result,
        providerName: this.getProvider(provider)?.name ?? provider,
      }
    );

    return result;
  }

  private _amountRisk(amount: number, maxScore: number): number {
    const remainingTotal = this.remainingAllowance();
    const remainingDaily = this.remainingDailyAllowance();
    const perTxCap = this.agentPolicy.perTxCap;

    let available = perTxCap;
    if (remainingDaily < available) available = remainingDaily;
    if (remainingTotal < available) available = remainingTotal;
    if (available === 0) return maxScore;

    const risk = Math.floor((amount * maxScore) / available);
    return risk > maxScore ? maxScore : risk;
  }

  private _stakeRisk(
    provider: string,
    amount: number,
    maxScore: number
  ): number {
    const available = this.availableStake(provider);

    if (available === 0) return maxScore;
    if (available >= amount) return 0;

    const risk = Math.floor(
      ((amount - available) * maxScore) / amount
    );

    return risk > maxScore ? maxScore : risk;
  }

  private _frequencyRisk(
    provider: string,
    maxScore: number
  ): number {
    const policy = FIREWALL_POLICY;
    const times =
      this.providerRequestTimes.get(
        provider.toLowerCase()
      ) ?? [];

    const cutoff = Date.now() - policy.frequencyWindow;
    let recentRequests = 0;

    for (let i = times.length - 1; i >= 0; i--) {
      if (
        recentRequests >= policy.frequencyLimit ||
        times[i] < cutoff
      ) {
        break;
      }
      recentRequests++;
    }

    const risk = Math.floor(
      (recentRequests * maxScore) / policy.frequencyLimit
    );

    return risk > maxScore ? maxScore : risk;
  }

  private _decisionFor(score: number): FirewallDecision {
    const policy = FIREWALL_POLICY;

    if (score < policy.flagThreshold) return "AUTO_PAY";
    if (score < policy.approvalThreshold) return "FLAG";
    if (score < policy.blockThreshold) return "REQUIRE_APPROVAL";
    return "BLOCK";
  }

  approveRequest(requestId: string): boolean {
    const req = this.pendingRequests.get(requestId);
    if (!req || req.status !== "Pending") return false;

    req.status = "Approved";

    this._emit(
      "request_approved",
      `Request ${requestId.slice(0, 10)}... approved`,
      { requestId }
    );

    return true;
  }

  rejectRequest(requestId: string): boolean {
    const req = this.pendingRequests.get(requestId);
    if (!req || req.status !== "Pending") return false;

    req.status = "Rejected";

    this._emit(
      "request_rejected",
      `Request ${requestId.slice(0, 10)}... rejected`,
      { requestId }
    );

    return true;
  }

  recordSuccessfulPayment(
    agent: string,
    provider: string
  ): void {
    const agentKey = agent.toLowerCase();
    const providerKey = provider.toLowerCase();

    if (!this.hasSuccessfulPayment.has(agentKey)) {
      this.hasSuccessfulPayment.set(agentKey, new Set());
    }

    this.hasSuccessfulPayment.get(agentKey)!.add(providerKey);
  }

  // ── Payment Escrow (mirrors PaymentEscrow.sol) ─────

  createJob(
    provider: string,
    amount: number,
    stakeRequired: number,
    deadline: number,
    serviceId: string,
    taskDescription: string = ""
  ): SimJob | null {
    // Validate spending
    const validation = this.validateSpending(amount);

    if (!validation.valid) {
      this._emit(
        "payment_rejected",
        `Payment rejected: ${validation.reason}`,
        { provider, amount, reason: validation.reason }
      );
      return null;
    }

    // Check provider eligibility
    if (!this.isEligible(provider)) {
      this._emit(
        "payment_rejected",
        `Provider ${this.getProvider(provider)?.name ?? provider} is not eligible`,
        { provider, amount }
      );
      return null;
    }

    // Check provider has enough available stake
    if (
      stakeRequired > 0 &&
      this.availableStake(provider) < stakeRequired
    ) {
      this._emit(
        "payment_rejected",
        `Insufficient provider stake for collateral`,
        { provider, stakeRequired, available: this.availableStake(provider) }
      );
      return null;
    }

    // Lock provider collateral
    if (stakeRequired > 0) {
      this.lockStake(provider, stakeRequired);
    }

    // Debit vault
    this.vaultBalance -= amount;
    this.totalSpent += amount;
    this.dailySpent += amount;

    const jobId = this.nextJobId++;

    const job: SimJob = {
      jobId,
      agent: this.agentAddress,
      provider: provider as `0x${string}`,
      amount,
      stakeRequired,
      createdAt: Date.now(),
      deadline,
      deliveryAt: 0,
      serviceId,
      deliveryHash: "",
      status: "Funded",
      taskDescription,
    };

    this.jobs.set(jobId, job);

    const providerName =
      this.getProvider(provider)?.name ?? provider;

    this._emit(
      "job_created",
      `Job #${jobId} created: ${this._formatUSDC(amount)} → ${providerName} for ${serviceId}`,
      {
        jobId,
        provider,
        providerName,
        amount,
        stakeRequired,
        serviceId,
        taskDescription,
      }
    );

    return job;
  }

  submitDelivery(
    jobId: number,
    deliveryHash?: string
  ): boolean {
    const job = this.jobs.get(jobId);

    if (!job) return false;
    if (job.status !== "Funded") return false;
    if (Date.now() >= job.deadline) return false;

    job.deliveryHash =
      deliveryHash ??
      createHash("sha256")
        .update(`delivery-${jobId}-${Date.now()}`)
        .digest("hex");

    job.deliveryAt = Date.now();
    job.status = "WorkSubmitted";

    const providerName =
      this.getProvider(job.provider)?.name ?? job.provider;

    this._emit(
      "delivery_submitted",
      `Provider ${providerName} submitted delivery for Job #${jobId}`,
      {
        jobId,
        provider: job.provider,
        providerName,
        deliveryHash: job.deliveryHash,
      }
    );

    return true;
  }

  settleJob(jobId: number): boolean {
    const job = this.jobs.get(jobId);

    if (!job) return false;
    if (job.status !== "WorkSubmitted") return false;

    job.status = "Settled";

    // Unlock provider collateral
    if (job.stakeRequired > 0) {
      this.unlockStake(job.provider, job.stakeRequired);
    }

    // Record successful payment for firewall
    this.recordSuccessfulPayment(job.agent, job.provider);

    const providerName =
      this.getProvider(job.provider)?.name ?? job.provider;

    this._emit(
      "job_settled",
      `Job #${jobId} settled: ${this._formatUSDC(job.amount)} paid to ${providerName}`,
      {
        jobId,
        provider: job.provider,
        providerName,
        amount: job.amount,
      }
    );

    return true;
  }

  refundJob(jobId: number): boolean {
    const job = this.jobs.get(jobId);

    if (!job) return false;
    if (job.status !== "Funded") return false;

    job.status = "Refunded";

    // Refund vault
    this.vaultBalance += job.amount;
    this.totalSpent -= job.amount;

    // Slash provider
    if (job.stakeRequired > 0) {
      this.slashLocked(job.provider, job.stakeRequired);
    }

    const providerName =
      this.getProvider(job.provider)?.name ?? job.provider;

    this._emit(
      "job_refunded",
      `Job #${jobId} refunded: ${this._formatUSDC(job.amount)} back to vault, ${providerName} slashed`,
      {
        jobId,
        provider: job.provider,
        providerName,
        amount: job.amount,
        slashed: job.stakeRequired,
      }
    );

    return true;
  }

  // ── Utility ────────────────────────────────────────

  generateRequestId(): string {
    return "0x" + randomBytes(32).toString("hex");
  }

  generateServiceId(service: string): string {
    return createHash("sha256")
      .update(service)
      .digest("hex");
  }

  getNextNonce(): number {
    return this.nonce++;
  }

  // ── State Snapshot ─────────────────────────────────

  getState() {
    return {
      agent: {
        address: this.agentAddress,
        vaultBalance: this.vaultBalance,
        totalSpent: this.totalSpent,
        dailySpent: this.dailySpent,
        remainingAllowance: this.remainingAllowance(),
        remainingDailyAllowance: this.remainingDailyAllowance(),
        policy: this.agentPolicy,
        nonce: this.nonce,
      },
      providers: Array.from(this.providers.values()),
      jobs: Array.from(this.jobs.values()),
      pendingRequests: Array.from(
        this.pendingRequests.values()
      ),
      taskQueue: this.taskQueue,
      completedTasks: this.completedTasks,
      treasuryBalance: this.treasuryBalance,
      stats: {
        totalJobs: this.jobs.size,
        settledJobs: Array.from(this.jobs.values()).filter(
          (j) => j.status === "Settled"
        ).length,
        refundedJobs: Array.from(this.jobs.values()).filter(
          (j) => j.status === "Refunded"
        ).length,
        activeJobs: Array.from(this.jobs.values()).filter(
          (j) =>
            j.status === "Funded" ||
            j.status === "WorkSubmitted"
        ).length,
        pendingTasks: this.taskQueue.length,
        completedTasks: this.completedTasks.length,
      },
      recentEvents: this.events.slice(-50),
    };
  }

  // ── Event System ───────────────────────────────────

  addEventListener(
    listener: (event: SimEvent) => void
  ): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(
    listener: (event: SimEvent) => void
  ): void {
    this.eventListeners = this.eventListeners.filter(
      (l) => l !== listener
    );
  }

  private _emit(
    type: string,
    message: string,
    data: Record<string, unknown>
  ): void {
    const event: SimEvent = {
      id: randomBytes(8).toString("hex"),
      timestamp: Date.now(),
      type,
      message,
      data,
    };

    this.events.push(event);

    // Keep only last 500 events
    if (this.events.length > 500) {
      this.events = this.events.slice(-500);
    }

    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Swallow listener errors
      }
    }
  }

  _formatUSDC(amount: number): string {
    return `$${(amount / 1_000_000).toFixed(2)}`;
  }
}

// Singleton instance
export const simulator = new SimulationEngine();
