import express from "express";
import cors from "cors";

import { env } from "./config/env.js";
import type { PaymentRequest } from "./types/payment.js";
import { validatePaymentRequest } from "./utils/validation.js";
import { validateAuthorization } from "./services/authorization.js";
import { executePayment } from "./services/payment.js";
import { createEscrowJob } from "./services/escrow.js";
import { simulator } from "./services/simulator.js";
import {
  startDemoAgent,
  stopDemoAgent,
  isDemoAgentRunning,
  getDecisions,
  setAgentSpeed,
} from "./services/demo-agent.js";
import { attachSimulatorLogger } from "./services/demo-logger.js";

const app = express();

app.use(express.json());
app.use(cors());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "apex-gateway",
    demoMode: env.demoMode,
  });
});

app.post("/v1/payments/execute", async (req, res) => {
  try {
    const request = req.body as PaymentRequest;

    validatePaymentRequest(request);

    if (request.agent.toLowerCase() !== env.agentAddress.toLowerCase()) {
      return res.status(403).json({
        error: "Unauthorized agent"
      });
    }

    const authorized = await validateAuthorization(request);

    if (!authorized) {
      return res.status(403).json({
        error: "Payment intent is not authorized"
      });
    }

    const paymentTx = await executePayment(request);

    const escrowTx = await createEscrowJob(request);

    return res.status(200).json({
      requestId: request.requestId,
      paymentTx,
      escrowTx,
      status: "submitted"
    });
  } catch (error) {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    return res.status(400).json({
      error: message
    });
  }
});

// ════════════════════════════════════════════════════════
// DEMO MODE ROUTES
// ════════════════════════════════════════════════════════

if (env.demoMode) {
  console.log("🎮 DEMO MODE ENABLED — no on-chain transactions");

  // Attach Supabase logger
  attachSimulatorLogger();

  // ── Demo Status ──────────────────────────────────

  app.get("/v1/demo/status", (_req, res) => {
    res.json({
      demoMode: true,
      agentRunning: isDemoAgentRunning(),
      state: simulator.getState(),
    });
  });

  // ── Start Agent ──────────────────────────────────

  app.post("/v1/demo/start", (req, res) => {
    if (isDemoAgentRunning()) {
      return res.status(400).json({
        error: "Agent is already running",
      });
    }

    const speed = req.body?.speed ?? env.demoAgentSpeed;
    startDemoAgent(speed);

    return res.json({
      status: "started",
      speed,
    });
  });

  // ── Stop Agent ───────────────────────────────────

  app.post("/v1/demo/stop", (_req, res) => {
    if (!isDemoAgentRunning()) {
      return res.status(400).json({
        error: "Agent is not running",
      });
    }

    stopDemoAgent();

    return res.json({
      status: "stopped",
    });
  });

  // ── Reset Simulation ─────────────────────────────

  app.post("/v1/demo/reset", (_req, res) => {
    if (isDemoAgentRunning()) {
      stopDemoAgent();
    }

    simulator.reset();

    return res.json({
      status: "reset",
      state: simulator.getState(),
    });
  });

  // ── Set Speed ────────────────────────────────────

  app.post("/v1/demo/speed", (req, res) => {
    const speed = req.body?.speed;

    if (!speed || typeof speed !== "number" || speed < 500) {
      return res.status(400).json({
        error: "Speed must be a number >= 500 (ms)",
      });
    }

    setAgentSpeed(speed);

    return res.json({
      status: "speed_updated",
      speed,
    });
  });

  // ── List Providers ───────────────────────────────

  app.get("/v1/demo/providers", (_req, res) => {
    const providers = Array.from(
      simulator.providers.values()
    ).map((p) => ({
      ...p,
      availableStake: simulator.availableStake(
        p.address
      ),
      eligible: simulator.isEligible(p.address),
    }));

    res.json({ providers });
  });

  // ── List Jobs ────────────────────────────────────

  app.get("/v1/demo/jobs", (_req, res) => {
    const jobs = Array.from(
      simulator.jobs.values()
    ).sort((a, b) => b.createdAt - a.createdAt);

    res.json({ jobs });
  });

  // ── List Events ──────────────────────────────────

  app.get("/v1/demo/events", (req, res) => {
    const limit = Number(req.query.limit ?? 50);
    const events = simulator.events.slice(-limit);

    res.json({ events });
  });

  // ── Agent Decisions ──────────────────────────────

  app.get("/v1/demo/decisions", (req, res) => {
    const limit = Number(req.query.limit ?? 20);
    const allDecisions = getDecisions();

    res.json({
      decisions: allDecisions.slice(-limit),
      total: allDecisions.length,
    });
  });

  // ── Approve/Reject Pending Requests ──────────────

  app.post("/v1/demo/approve/:requestId", (req, res) => {
    const { requestId } = req.params;

    if (!simulator.approveRequest(requestId)) {
      return res.status(404).json({
        error: "Request not found or not pending",
      });
    }

    return res.json({ status: "approved", requestId });
  });

  app.post("/v1/demo/reject/:requestId", (req, res) => {
    const { requestId } = req.params;

    if (!simulator.rejectRequest(requestId)) {
      return res.status(404).json({
        error: "Request not found or not pending",
      });
    }

    return res.json({ status: "rejected", requestId });
  });

  // ── SSE Event Stream ─────────────────────────────

  app.get("/v1/demo/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    // Send initial state
    res.write(
      `data: ${JSON.stringify({ type: "init", state: simulator.getState() })}\n\n`
    );

    // Listen for events
    const listener = (
      event: { id: string; timestamp: number; type: string; message: string; data: Record<string, unknown> }
    ) => {
      res.write(
        `data: ${JSON.stringify({ type: "event", event })}\n\n`
      );
    };

    simulator.addEventListener(listener);

    // Send periodic state updates
    const stateInterval = setInterval(() => {
      res.write(
        `data: ${JSON.stringify({ type: "state", state: simulator.getState() })}\n\n`
      );
    }, 2000);

    req.on("close", () => {
      simulator.removeEventListener(listener);
      clearInterval(stateInterval);
    });
  });
}

app.listen(env.port, () => {
  console.log(
    `APEX Gateway listening on http://localhost:${env.port}`
  );

  if (env.demoMode) {
    console.log("  Demo endpoints:");
    console.log(`    GET  /v1/demo/status`);
    console.log(`    POST /v1/demo/start`);
    console.log(`    POST /v1/demo/stop`);
    console.log(`    POST /v1/demo/reset`);
    console.log(`    POST /v1/demo/speed`);
    console.log(`    GET  /v1/demo/providers`);
    console.log(`    GET  /v1/demo/jobs`);
    console.log(`    GET  /v1/demo/events`);
    console.log(`    GET  /v1/demo/decisions`);
    console.log(`    GET  /v1/demo/stream (SSE)`);
  }
});