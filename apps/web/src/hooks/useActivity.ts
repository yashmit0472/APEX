"use client";

import { useCallback, useEffect, useState } from "react";

export type ActivityDecision =
    | "AUTO_PAY"
    | "FLAG"
    | "REQUIRE_APPROVAL"
    | "BLOCK"
    | null;

export type ActivityStatus =
    | "VERIFIED"
    | "PENDING"
    | "FAILED"
    | "—";

export type ActivityItem = {
    id: string;
    provider: string;
    amount: string;
    decision: ActivityDecision;
    riskScore: number | null;
    status: ActivityStatus;
    timestamp?: string;
    txHash?: string | null;
    delivery?: string | null;
};

interface ActivityResponse {
    activities: ActivityItem[];
}

export function useActivity() {
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchActivity = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch("/api/activity", {
                method: "GET",
                cache: "no-store",
            });

            if (!response.ok) {
                throw new Error(
                    "Failed to load payment activity"
                );
            }

            const data: ActivityResponse =
                await response.json();

            setActivities(data.activities ?? []);
        } catch (err) {
            console.error(
                "Failed to load activity:",
                err
            );

            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to load activity"
            );

            setActivities([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchActivity();
    }, [fetchActivity]);

    return {
        activities,
        isLoading,
        error,
        refresh: fetchActivity,
    };
}