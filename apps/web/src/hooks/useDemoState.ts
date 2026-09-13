"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3001";

// ── Types ──────────────────────────────────────────────

export interface DemoProvider {
  address: string;
  name: string;
  serviceType: string;
  endpoint: string;
  registered: boolean;
  active: boolean;
  stakedBalance: number;
  lockedBalance: number;
  reliability: number;
  registeredAt: number;
  availableStake?: number;
  eligible?: boolean;
}

export interface DemoJob {
  jobId: number;
  agent: string;
  provider: string;
  amount: number;
  stakeRequired: number;
  createdAt: number;
  deadline: number;
  deliveryAt: number;
  serviceId: string;
  deliveryHash: string;
  status: string;
  taskDescription: string;
}

export interface DemoEvent {
  id: string;
  timestamp: number;
  type: string;
  message: string;
  data: Record<string, unknown>;
}

export interface DemoDecision {
  timestamp: number;
  task: {
    id: string;
    description: string;
    serviceType: string;
    estimatedCost: number;
    priority: string;
    stakeRequired: number;
  };
  reasoning: string[];
  selectedProvider: DemoProvider | null;
  firewallScore: number | null;
  firewallDecision: string | null;
  outcome: string;
  jobId: number | null;
}

export interface DemoState {
  demoMode: boolean;
  agentRunning: boolean;
  state: {
    agent: {
      address: string;
      vaultBalance: number;
      totalSpent: number;
      dailySpent: number;
      remainingAllowance: number;
      remainingDailyAllowance: number;
      policy: {
        maxSpend: number;
        perTxCap: number;
        dailyCap: number;
        expiresAt: number;
        authorized: boolean;
      };
      nonce: number;
    };
    providers: DemoProvider[];
    jobs: DemoJob[];
    pendingRequests: unknown[];
    taskQueue: unknown[];
    completedTasks: unknown[];
    treasuryBalance: number;
    stats: {
      totalJobs: number;
      settledJobs: number;
      refundedJobs: number;
      activeJobs: number;
      pendingTasks: number;
      completedTasks: number;
    };
    recentEvents: DemoEvent[];
  };
}

// ── Hook ───────────────────────────────────────────────

export function useDemoState() {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<DemoState | null>(null);
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [decisions, setDecisions] = useState<DemoDecision[]>([]);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // ── SSE Connection ─────────────────────────────────

  const connect = useCallback(function connect() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(
      `${GATEWAY_URL}/v1/demo/stream`
    );

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);

        if (data.type === "init" || data.type === "state") {
          setState((prev) => ({
            demoMode: true,
            agentRunning: prev?.agentRunning ?? false,
            state: data.state,
          }));
        }

        if (data.type === "event") {
          setEvents((prev) => {
            const next = [...prev, data.event];
            return next.slice(-200);
          });
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setConnected(false);
      setError("Connection to demo gateway lost");

      // Reconnect after 3s
      setTimeout(() => {
        connect();
      }, 3000);
    };

    eventSourceRef.current = es;
  }, []);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnected(false);
  }, []);

  // ── API Calls ──────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `${GATEWAY_URL}/v1/demo/status`
      );

      if (!res.ok) throw new Error("Failed to fetch status");

      const data: DemoState = await res.json();
      setState(data);
      setError(null);
      return data;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch status"
      );
      return null;
    }
  }, []);

  const submitPrompt = useCallback(
    async (prompt: string) => {
      try {
        const res = await fetch(
          `${GATEWAY_URL}/v1/demo/prompt`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
          }
        );

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to process prompt");
        }

        // Fetch new decisions immediately
        fetchDecisions();

        return true;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to process prompt"
        );
        return false;
      }
    },
    []
  );

  const resetSimulation = useCallback(async () => {
    try {
      const res = await fetch(
        `${GATEWAY_URL}/v1/demo/reset`,
        { method: "POST" }
      );

      if (!res.ok) throw new Error("Failed to reset");

      const data = await res.json();

      setState({
        demoMode: true,
        agentRunning: false,
        state: data.state,
      });

      setEvents([]);
      setDecisions([]);

      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to reset simulation"
      );
      return false;
    }
  }, []);



  const fetchDecisions = useCallback(async () => {
    try {
      const res = await fetch(
        `${GATEWAY_URL}/v1/demo/decisions?limit=30`
      );

      if (!res.ok) return;

      const data = await res.json();
      setDecisions(data.decisions ?? []);
    } catch {
      // Silently fail
    }
  }, []);

  // ── Lifecycle ──────────────────────────────────────

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStatus().then((data) => {
      if (data?.demoMode) {
        connect();
      }
    });

    return () => disconnect();
  }, [fetchStatus, connect, disconnect]);

  // Poll decisions periodically
  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(fetchDecisions, 3000);

    return () => clearInterval(interval);
  }, [connected, fetchDecisions]);

  return {
    connected,
    state,
    events,
    decisions,
    error,

    submitPrompt,
    resetSimulation,
    fetchStatus,
    fetchDecisions,

    connect,
    disconnect,
  };
}
