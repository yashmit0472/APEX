"use client";

import type { Hex } from "viem";

type Props = {
  status:
    | "idle"
    | "submitting"
    | "confirming"
    | "confirmed"
    | "failed";

  requestId: Hex | null;
  hash?: Hex;
  approvedHash?: Hex;

  decision:
    | "idle"
    | "allow"
    | "review"
    | "block"
    | "pending";

  score: bigint | null;
  jobId: bigint | null;

  error?: string;
  onApprove?: () => void;
  approvalPending?: boolean;
};

export function PaymentStatus({
  status,
  requestId,
  hash,
  approvedHash,
  decision,
  score,
  jobId,
  error,
  onApprove,
  approvalPending,
}: Props) {
  if (
    status === "idle" &&
    !requestId &&
    !hash
  ) {
    return null;
  }

  return (
    <div className="payment-status-panel">

      <div className="status-row">
        <span>Status</span>

        <strong>
          {status === "submitting" &&
            "SUBMITTING"}

          {status === "confirming" &&
            "CONFIRMING"}

          {status === "confirmed" &&
            "CONFIRMED"}

          {status === "failed" &&
            "FAILED"}

          {status === "idle" &&
            "READY"}
        </strong>
      </div>

      {requestId && (
        <div className="status-row">
          <span>Request ID</span>

          <code>
            {requestId.slice(0, 14)}
            ...
            {requestId.slice(-8)}
          </code>
        </div>
      )}

      {hash && (
        <div className="status-row">
          <span>Execution TX</span>

          <code>
            {hash.slice(0, 14)}
            ...
            {hash.slice(-8)}
          </code>
        </div>
      )}

      {score !== null && (
        <div className="status-row">
          <span>Risk Score</span>

          <strong>
            {score.toString()}
          </strong>
        </div>
      )}

      {decision !== "idle" && (
        <div className="status-row">
          <span>Firewall</span>

          <strong
            className={
              decision === "allow"
                ? "firewall-allow"
                : decision === "block"
                  ? "firewall-block"
                  : decision === "review"
                    ? "firewall-review"
                    : "firewall-pending"
            }
          >
            {decision === "pending"
              ? "EVALUATING"
              : decision.toUpperCase()}
          </strong>
        </div>
      )}

      {jobId !== null && (
        <div className="status-row">
          <span>Escrow Job</span>

          <strong>
            #{jobId.toString()}
          </strong>
        </div>
      )}

      {decision === "review" &&
        onApprove && (
          <div className="approval-panel">
            <div>
              <strong>
                Manual approval required
              </strong>

              <p>
                The firewall has placed this
                payment into review.
              </p>
            </div>

            <button
              className="approve-button"
              onClick={onApprove}
              disabled={approvalPending}
            >
              {approvalPending
                ? "Confirm in Wallet..."
                : "Approve Payment"}
            </button>
          </div>
        )}

      {approvedHash && (
        <div className="status-row">
          <span>Approval TX</span>

          <code>
            {approvedHash.slice(0, 14)}
            ...
            {approvedHash.slice(-8)}
          </code>
        </div>
      )}

      {error && (
        <div className="payment-error">
          {error}
        </div>
      )}
    </div>
  );
}
