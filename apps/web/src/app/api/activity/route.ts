import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase/client";

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
            provider: row.provider_address,
            amount: Number(row.amount) / 1_000_000,
            decision: row.firewall_decision,
            riskScore: row.risk_score,
            status: row.status,
            timestamp: row.created_at,
            txHash: null,
            delivery: null,
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