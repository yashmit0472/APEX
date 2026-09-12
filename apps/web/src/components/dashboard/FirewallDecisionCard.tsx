"use client";

export type FirewallDecision =
    | "AUTO-PAY"
    | "FLAG"
    | "REQUIRE APPROVAL"
    | "BLOCK";

interface FirewallFactor {
    name: string;
    score: number;
}

interface FirewallDecisionCardProps {
    decision: FirewallDecision;
    score: number;
    factors?: FirewallFactor[];
    requestId?: string;
}

const decisionConfig = {
    "AUTO-PAY": {
        label: "AUTO-PAY",
        description: "Transaction is within acceptable risk limits.",
        className: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        icon: "✓",
    },

    FLAG: {
        label: "FLAG",
        description: "Transaction is allowed but requires monitoring.",
        className: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        icon: "!",
    },

    "REQUIRE APPROVAL": {
        label: "REQUIRE APPROVAL",
        description: "Owner approval is required before payment.",
        className: "text-orange-400",
        bg: "bg-orange-500/10",
        border: "border-orange-500/20",
        icon: "⚠",
    },

    BLOCK: {
        label: "BLOCK",
        description: "Transaction exceeds the configured risk boundary.",
        className: "text-red-400",
        bg: "bg-red-500/10",
        border: "border-red-500/20",
        icon: "×",
    },
};

export function FirewallDecisionCard({
    decision,
    score,
    factors = [],
    requestId,
}: FirewallDecisionCardProps) {
    const config = decisionConfig[decision];

    const normalizedScore = Math.max(
        0,
        Math.min(100, score)
    );

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="text-sm font-medium text-white/50">
                        Firewall Decision
                    </p>

                    <div className="mt-3 flex items-center gap-4">
                        <div className="text-5xl font-bold">
                            {normalizedScore}
                        </div>

                        <div className="text-sm text-white/40">
                            / 100
                            <div className="mt-1">
                                Risk score
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    className={`rounded-xl border px-5 py-4 ${config.bg} ${config.border}`}
                >
                    <div
                        className={`flex items-center gap-2 font-semibold ${config.className}`}
                    >
                        <span>{config.icon}</span>
                        {config.label}
                    </div>

                    <p className="mt-1 max-w-xs text-xs text-white/50">
                        {config.description}
                    </p>
                </div>
            </div>

            <div className="mt-6">
                <div className="mb-2 flex justify-between text-xs">
                    <span className="text-white/40">
                        Risk level
                    </span>

                    <span className="text-white/50">
                        {normalizedScore}%
                    </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                        className="h-full rounded-full transition-all"
                        style={{
                            width: `${normalizedScore}%`,
                        }}
                    />
                </div>
            </div>

            {factors.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-sm font-medium">
                        Risk Factors
                    </h3>

                    <div className="mt-3 space-y-3">
                        {factors.map((factor) => (
                            <div
                                key={factor.name}
                                className="flex items-center justify-between"
                            >
                                <span className="text-sm text-white/60">
                                    {factor.name}
                                </span>

                                <span className="text-sm font-medium">
                                    +{factor.score}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {requestId && (
                <div className="mt-6 border-t border-white/10 pt-4">
                    <p className="text-xs text-white/40">
                        Request ID
                    </p>

                    <p className="mt-1 break-all font-mono text-xs text-white/60">
                        {requestId}
                    </p>
                </div>
            )}
        </div>
    );
}