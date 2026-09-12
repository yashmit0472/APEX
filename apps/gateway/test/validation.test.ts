import assert from "node:assert/strict";
import { validatePaymentRequest } from "../src/utils/validation.js";

const validRequest = {
  requestId:
    "0x1234567890123456789012345678901234567890123456789012345678901234",
  agent: "0x1111111111111111111111111111111111111111",
  provider: "0x2222222222222222222222222222222222222222",
  amount: "1000000",
  serviceType: "data"
} as const;

validatePaymentRequest(validRequest);

assert.throws(() => {
  validatePaymentRequest({
    ...validRequest,
    requestId: "0x1234"
  });
});

assert.throws(() => {
  validatePaymentRequest({
    ...validRequest,
    agent: "invalid"
  });
});

assert.throws(() => {
  validatePaymentRequest({
    ...validRequest,
    amount: "0"
  });
});

assert.throws(() => {
  validatePaymentRequest({
    ...validRequest,
    amount: "-1"
  });
});

assert.throws(() => {
  validatePaymentRequest({
    ...validRequest,
    serviceType: ""
  });
});

console.log("Gateway validation tests passed");