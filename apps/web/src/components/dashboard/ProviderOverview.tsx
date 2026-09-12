"use client";

export interface ProviderOverviewData {
    id: string;
    name: string;
    serviceType: string;
    price: string;
    reputation: number;
    stake: string;
    eligible: boolean;
}

interface ProviderOverviewProps {
    providers: ProviderOverviewData[];
}

export function ProviderOverview({
    providers,
}: ProviderOverviewProps) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">
                        Providers
                    </h2>

                    <p className="mt-1 text-sm text-white/40">
                        Payment counterparties and eligibility
                    </p>
                </div>

                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/50">
                    {providers.length} providers
                </span>
            </div>

            <div className="mt-5 space-y-3">
                {providers.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">
                        No providers available.
                    </div>
                ) : (
                    providers.map((provider) => (
                        <div
                            key={provider.id}
                            className="rounded-xl border border-white/10 bg-black/10 p-4"
                        >
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="font-medium">
                                        {provider.name}
                                    </div>

                                    <div className="mt-1 text-xs text-white/40">
                                        {provider.serviceType}
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-6 text-sm">
                                    <div>
                                        <div className="text-xs text-white/40">
                                            Price
                                        </div>
                                        <div className="mt-1">
                                            ${provider.price}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs text-white/40">
                                            Reputation
                                        </div>
                                        <div className="mt-1">
                                            {provider.reputation}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs text-white/40">
                                            Stake
                                        </div>
                                        <div className="mt-1">
                                            ${provider.stake}
                                        </div>
                                    </div>
                                </div>

                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-medium ${provider.eligible
                                            ? "bg-emerald-500/10 text-emerald-400"
                                            : "bg-red-500/10 text-red-400"
                                        }`}
                                >
                                    {provider.eligible
                                        ? "ELIGIBLE"
                                        : "INELIGIBLE"}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}