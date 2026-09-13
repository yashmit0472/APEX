/**
 * Demo Providers
 *
 * Simulated providers that "complete work" after random delays.
 * Each provider has a reliability score — unreliable providers
 * occasionally fail, triggering refunds and stake slashing.
 */

import { simulator } from "./simulator.js";
import type { SimJob } from "./simulator.js";

type JobWatcher = {
  jobId: number;
  timeout: ReturnType<typeof setTimeout>;
};

let activeWatchers: JobWatcher[] = [];
let running = false;

/**
 * Start watching for new funded jobs and simulate
 * provider delivery behavior.
 */
export function startProviderSimulation(): void {
  running = true;

  console.log("[demo-providers] Provider simulation started");
}

/**
 * Stop all provider simulation.
 */
export function stopProviderSimulation(): void {
  running = false;

  for (const watcher of activeWatchers) {
    clearTimeout(watcher.timeout);
  }

  activeWatchers = [];

  console.log("[demo-providers] Provider simulation stopped");
}

function generateMockData(serviceType: string, taskDescription: string) {
  if (serviceType === "GPU_COMPUTE") {
    return {
      providers: [
        { model: "A100 80GB", pricePerHour: 1.25, availability: "High" },
        { model: "H100 PCIe", pricePerHour: 2.50, availability: "Low" },
        { model: "RTX 4090", pricePerHour: 0.45, availability: "Medium" }
      ],
      recommendation: "RTX 4090 offers the best cost-to-performance ratio for this workload."
    };
  }
  if (serviceType === "DATA_API") {
    return {
      dataset: "market_data_2026",
      rowsReturned: 50000,
      sample: [
        { symbol: "BTC", price: 85200, volume: 15200000 },
        { symbol: "ETH", price: 4200, volume: 5500000 }
      ]
    };
  }
  if (serviceType === "WEB_RESEARCH") {
    return {
      summary: "Found relevant sources matching the query.",
      sources: [
        "https://example.com/source-1",
        "https://example.com/source-2"
      ],
      keyFindings: [
        "The market is trending upwards.",
        "New competitor entered the space."
      ]
    };
  }
  return { success: true, message: "Task completed successfully" };
}

/**
 * Called by the demo agent after a job is created.
 * Simulates the provider receiving the job, doing work,
 * and submitting delivery (or failing).
 */
export function simulateProviderWork(job: SimJob): void {
  if (!running) return;

  const provider = simulator.getProvider(job.provider);
  if (!provider) return;

  // Work duration: 3-12 seconds (simulated)
  const workDuration =
    3000 + Math.random() * 9000;

  const timeout = setTimeout(() => {
    if (!running) return;

    // Remove from active watchers
    activeWatchers = activeWatchers.filter(
      (w) => w.jobId !== job.jobId
    );

    // Check if provider successfully completes
    const success = Math.random() < provider.reliability;

    if (success) {
      const resultData = generateMockData(provider.serviceType, job.taskDescription);

      // Provider submits delivery
      const delivered = simulator.submitDelivery(
        job.jobId,
        undefined,
        resultData
      );

      if (delivered) {
        // Auto-settle after a short verification delay
        const settleDelay = 1000 + Math.random() * 2000;

        setTimeout(() => {
          if (!running) return;
          simulator.settleJob(job.jobId);
        }, settleDelay);
      }
    } else {
      // Provider failed to deliver
      // If past deadline, the job gets refunded

      simulator.events.push({
        id: Math.random().toString(36).slice(2),
        timestamp: Date.now(),
        type: "provider_failed",
        message: `Provider ${provider.name} failed to deliver Job #${job.jobId} — deadline expired`,
        data: {
          jobId: job.jobId,
          provider: provider.address,
          providerName: provider.name,
          reason: "work_failed",
        },
      });

      // Simulate deadline expiry by refunding
      simulator.refundJob(job.jobId);
    }
  }, workDuration);

  activeWatchers.push({ jobId: job.jobId, timeout });
}

/**
 * Check if the provider simulation is currently running.
 */
export function isProviderSimulationRunning(): boolean {
  return running;
}

/**
 * Get count of active provider work items.
 */
export function activeProviderWorkCount(): number {
  return activeWatchers.length;
}
