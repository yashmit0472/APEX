import express from "express";

import { env } from "./config/env.js";
import type { PaymentRequest } from "./types/payment.js";
import { validatePaymentRequest } from "./utils/validation.js";
import { validateAuthorization } from "./services/authorization.js";
import { executePayment } from "./services/payment.js";
import { createEscrowJob } from "./services/escrow.js";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "apex-gateway"
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

app.listen(env.port, () => {
  console.log(
    `APEX Gateway listening on http://localhost:${env.port}`
  );
});