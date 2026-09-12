"use client";

import { useAccount } from "wagmi";

interface DashboardHeaderProps {
    firewallActive?: boolean;
}

export function DashboardHeader({
    firewallActive = true,
}: DashboardHeaderProps) {
    const { address, isConnected } = useAccount();

    const shortAddress = address
        ? `${address.slice(0, 6)}...${address.slice(-4)}`
        : "Not connected";

    return (
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
            <div>
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight">
                        APEX Dashboard
                    </h1>

                    <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${firewallActive
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-red-500/10 text-red-400"
                            }`}
                    >
                        <span
                            className={`h-2 w-2 rounded-full ${firewallActive
                                    ? "bg-emerald-400"
                                    : "bg-red-400"
                                }`}
                        />

                        Firewall {firewallActive ? "Active" : "Inactive"}
                    </span>
                </div>

                <p className="mt-1 text-sm text-white/50">
                    Agent payment execution and security observability
                </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="text-xs text-white/40">
                    Wallet
                </div>

                <div className="mt-1 flex items-center gap-2 text-sm font-medium">
                    <span
                        className={`h-2 w-2 rounded-full ${isConnected
                                ? "bg-emerald-400"
                                : "bg-red-400"
                            }`}
                    />

                    {shortAddress}
                </div>
            </div>
        </div>
    );
}