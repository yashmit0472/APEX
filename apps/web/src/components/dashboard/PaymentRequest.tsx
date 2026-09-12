"use client";

import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { useAccount } from "wagmi";

import {
  usePaymentRouter,
  type FirewallDecision,
} from "../../hooks/usePaymentRouter";

import {
  getDeadline,
  isValidAddress,
} from "../../lib/payment";

type PaymentState =
  | "idle"
  | "submitting"
  | "confirming"
  | "confirmed"
  | "failed";

function decisionLabel(
  decision: FirewallDecision
) {
  switch (decision) {
    case "AUTO_PAY":
      return "AUTO PAY";

    case "FLAG":
      return "FLAGGED";

    case "REQUIRE_APPROVAL":
      return "REVIEW";

    case "BLOCK":
      return "BLOCKED";
  }
}

function decisionClass(
  decision: FirewallDecision
) {
  switch (decision) {
    case "AUTO_PAY":
      return "firewall-allow";

    case "FLAG":
      return "firewall-review";

    case "REQUIRE_APPROVAL":
      return "firewall-review";

    case "BLOCK":
      return "firewall-block";
  }
}

export function PaymentRequest() {
  const { address, isConnected } =
    useAccount();

  const {
    executePayment,
    executeApproved,
    getFirewallResult,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    reset,
  } = usePaymentRouter();

  const [provider, setProvider] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [service, setService] =
    useState("");

  const [deadlineMinutes, setDeadlineMinutes] =
    useState("30");

  const [requestId, setRequestId] =
    useState<Hex | null>(null);

  const [score, setScore] =
    useState<bigint | null>(null);

  const [decision, setDecision] =
    useState<FirewallDecision | null>(
      null
    );

  const [paymentState, setPaymentState] =
    useState<PaymentState>("idle");

  const [approvalHash, setApprovalHash] =
    useState<Hex>();

  const [approvalPending, setApprovalPending] =
    useState(false);

  const [formError, setFormError] =
    useState("");

  /*
   * After the Router transaction confirms,
   * decode the RiskEvaluated event.
   */
  useEffect(() => {
    if (!hash || !isConfirmed) {
      return;
    }

    let cancelled = false;

    async function readFirewallResult() {
      try {
        const result =
          await getFirewallResult(hash as Hex);

        if (cancelled || !result) {
          return;
        }

        setScore(result.score);
        setDecision(result.decision);
        setRequestId(result.requestId);

        setPaymentState("confirmed");
      } catch (err) {
        console.error(
          "Unable to decode firewall result",
          err
        );
      }
    }

    readFirewallResult();

    return () => {
      cancelled = true;
    };
  }, [
    hash,
    isConfirmed,
    getFirewallResult,
  ]);

  function resetPayment() {
    setProvider("");
    setAmount("");
    setService("");
    setDeadlineMinutes("30");

    setRequestId(null);
    setScore(null);
    setDecision(null);

    setApprovalHash(undefined);
    setApprovalPending(false);

    setPaymentState("idle");
    setFormError("");

    reset();
  }

  async function submitPayment() {
    setFormError("");
    setDecision(null);
    setScore(null);

    if (!isConnected || !address) {
      setFormError(
        "Connect your wallet first."
      );
      return;
    }

    if (!isValidAddress(provider)) {
      setFormError(
        "Enter a valid provider address."
      );
      return;
    }

    if (
      !amount ||
      Number(amount) <= 0
    ) {
      setFormError(
        "Enter a valid payment amount."
      );
      return;
    }

    if (!service.trim()) {
      setFormError(
        "Enter a service ID."
      );
      return;
    }

    try {
      setPaymentState("submitting");

      const id =
        await executePayment({
          provider:
            provider as `0x${string}`,

          amountUSDC: amount,

          serviceId: service,

          deadline: getDeadline(
            Number(deadlineMinutes) || 30
          ),

          nonce: BigInt(
            Date.now()
          ),
        });

      setRequestId(id);
      setPaymentState("confirming");
    } catch (err) {
      setPaymentState("failed");

      setFormError(
        err instanceof Error
          ? err.message
          : "Payment execution failed."
      );
    }
  }

  async function approvePayment() {
    if (!requestId) {
      return;
    }

    try {
      setFormError("");
      setApprovalPending(true);

      const tx =
        await executeApproved(
          requestId
        );

      setApprovalHash(
        tx as Hex
      );
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Approval failed."
      );
    } finally {
      setApprovalPending(false);
    }
  }

  return (
    <section className="payment-card">

      <div className="payment-card-header">
        <div>
          <p className="section-kicker">
            PAYMENT EXECUTION
          </p>

          <h2>Send Payment</h2>

          <p>
            Every payment passes through
            APEX authorization and risk
            evaluation.
          </p>
        </div>

        <div className="payment-live-indicator">
          <span />
          LOCALNET
        </div>
      </div>

      <div className="payment-form">

        <div className="form-field">
          <label>
            Provider Address
          </label>

          <input
            value={provider}
            onChange={(e) =>
              setProvider(
                e.target.value
              )
            }
            placeholder="0x..."
            spellCheck={false}
          />
        </div>

        <div className="form-field">
          <label>
            Amount (USDC)
          </label>

          <input
            value={amount}
            onChange={(e) =>
              setAmount(
                e.target.value
              )
            }
            placeholder="0.00"
            inputMode="decimal"
          />
        </div>

        <div className="form-field">
          <label>
            Service ID
          </label>

          <input
            value={service}
            onChange={(e) =>
              setService(
                e.target.value
              )
            }
            placeholder="api-request"
          />
        </div>

        <div className="form-field">
          <label>
            Deadline
          </label>

          <select
            value={deadlineMinutes}
            onChange={(e) =>
              setDeadlineMinutes(
                e.target.value
              )
            }
          >
            <option value="15">
              15 minutes
            </option>

            <option value="30">
              30 minutes
            </option>

            <option value="60">
              1 hour
            </option>

            <option value="120">
              2 hours
            </option>
          </select>
        </div>
      </div>

      {formError && (
        <div className="payment-error">
          {formError}
        </div>
      )}

      {error && (
        <div className="payment-error">
          {error.message}
        </div>
      )}

      <div className="payment-actions">

        <button
          className="primary-payment-button"
          onClick={submitPayment}
          disabled={
            isPending ||
            isConfirming ||
            !isConnected
          }
        >
          {isPending
            ? "Confirm in Wallet..."
            : isConfirming
              ? "Confirming..."
              : "Execute Payment"}
        </button>

        {(requestId || hash) && (
          <button
            className="secondary-payment-button"
            onClick={resetPayment}
          >
            Reset
          </button>
        )}
      </div>

      {(requestId ||
        hash ||
        approvalHash ||
        decision) && (

        <div className="payment-status-panel">

          <div className="status-row">
            <span>
              Status
            </span>

            <strong>
              {paymentState ===
                "submitting" &&
                "SUBMITTING"}

              {paymentState ===
                "confirming" &&
                "CONFIRMING"}

              {paymentState ===
                "confirmed" &&
                "CONFIRMED"}

              {paymentState ===
                "failed" &&
                "FAILED"}

              {paymentState ===
                "idle" &&
                "READY"}
            </strong>
          </div>

          {requestId && (
            <div className="status-row">
              <span>
                Request ID
              </span>

              <code>
                {requestId.slice(0, 14)}
                ...
                {requestId.slice(-8)}
              </code>
            </div>
          )}

          {hash && (
            <div className="status-row">
              <span>
                Transaction
              </span>

              <code>
                {hash.slice(0, 14)}
                ...
                {hash.slice(-8)}
              </code>
            </div>
          )}

          {score !== null && (
            <div className="status-row">
              <span>
                Risk Score
              </span>

              <strong>
                {score.toString()}
              </strong>
            </div>
          )}

          {decision && (
            <div className="status-row">
              <span>
                Firewall Decision
              </span>

              <strong
                className={decisionClass(
                  decision
                )}
              >
                {decisionLabel(
                  decision
                )}
              </strong>
            </div>
          )}

          {decision ===
            "REQUIRE_APPROVAL" && (
            <div className="approval-panel">

              <div>
                <strong>
                  Manual approval required
                </strong>

                <p>
                  The firewall has placed
                  this payment in review.
                </p>
              </div>

              <button
                className="approve-button"
                onClick={
                  approvePayment
                }
                disabled={
                  approvalPending
                }
              >
                {approvalPending
                  ? "Confirm in Wallet..."
                  : "Approve Payment"}
              </button>

            </div>
          )}

          {decision ===
            "BLOCK" && (
            <div className="payment-error">
              This payment was blocked by
              the APEX firewall.
            </div>
          )}

          {approvalHash && (
            <div className="status-row">
              <span>
                Approval TX
              </span>

              <code>
                {approvalHash.slice(
                  0,
                  14
                )}
                ...
                {approvalHash.slice(-8)}
              </code>
            </div>
          )}

        </div>
      )}
    </section>
  );
}
