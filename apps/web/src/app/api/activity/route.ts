import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase/client";

function toDollarAmount(amount: unknown) {
    const numeric = Number(amount ?? 0);

    if (!Number.isFinite(numeric)) {
        return 0;
    }

    return numeric / 1_000_000;
}

function normalizeStatus(status: unknown) {
    if (typeof status !== "string" || !status.trim()) {
        return "UNKNOWN";
    }

    return status.trim().toUpperCase();
}

export async function GET() {
    try {
        const { data, error } = await supabase
            .from("payment_intents")
            .select(`
                id,
                request_id,
                agent_address,
                provider_address,
                amount,
                service_id,
                risk_score,
                firewall_decision,
                status,
                created_at,
                updated_at
            `)
            .order("created_at", {
                ascending: false,
            })
            .limit(20);

        if (error) {
            console.error("Supabase activity error:", error);

            return NextResponse.json(
                {
                    error: "Failed to load payment activity",
                },
                {
                    status: 500,
                }
            );
        }

        const activities = (data ?? []).map((row) => ({
            id: row.id,
            provider: row.provider_address ?? "N/A",
            amount: toDollarAmount(row.amount),
            decision: row.firewall_decision ?? null,
            riskScore:
                typeof row.risk_score === "number"
                    ? row.risk_score
                    : null,
            status: normalizeStatus(row.status),
            timestamp: row.created_at ?? row.updated_at ?? undefined,
            txHash: null,
            delivery: row.service_id ?? null,
        }));

        return NextResponse.json({
            activities,
        });
    } catch (error) {
        console.error("Activity API error:", error);

        return NextResponse.json(
            {
                error: "Failed to load payment activity",
            },
            {
                status: 500,
            }
        );
    }
}
