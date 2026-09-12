"use client";

import type { ActivityItem } from "./ActivityTable";

interface TransactionDetailsProps {
    activity: ActivityItem | null;
    onClose: () => void;
}

export function TransactionDetails({
    activity,
    onClose,
}: TransactionDetailsProps) {
    if (!activity) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wider text-white/40">
                            Transaction Details
                        </p>

                        <h2 className="mt-2 text-xl font-semibold text-white">
                            {activity.provider}
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-3 py-2 text-white/50 transition hover:bg-white/5 hover:text-white"
                    >
                        ✕
                    </button>
                </div>

                <div className="mt-6 grid gap-3">
                    <DetailRow
                        label="Amount"
                        value={`$${activity.amount}`}
                    />

                    <DetailRow
                        label="Firewall Decision"
                        value={activity.decision ?? "—"}
                    />

                    <DetailRow
                        label="Delivery"
                        value={activity.delivery ?? "—"}
                    />

                    <DetailRow
                        label="Activity ID"
                        value={activity.id}
                    />

                    {activity.timestamp && (
                        <DetailRow
                            label="Timestamp"
                            value={activity.timestamp}
                        />
                    )}

                    {activity.txHash && (
                        <div className="rounded-xl border border-white/10 bg-white/3 p-4">
                            <p className="text-xs text-white/40">
                                Transaction Hash
                            </p>

                            <p className="mt-2 break-all font-mono text-xs text-white/70">
                                {activity.txHash}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function DetailRow({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/3 px-4 py-3">
            <span className="text-sm text-white/40">
                {label}
            </span>

            <span className="max-w-[65%] break-all text-right text-sm text-white">
                {value}
            </span>
        </div>
    );
}