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
      // Provider submits delivery
      const delivered = simulator.submitDelivery(
        job.jobId
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
