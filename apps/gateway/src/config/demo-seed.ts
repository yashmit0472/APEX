/**
 * Demo seed data — pre-configured providers, agent policy,
 * balances, and task queue for the simulation.
 */

export interface SeedProvider {
  address: `0x${string}`;
  name: string;
  serviceType: string;
  endpoint: string;
  stakeAmount: number;
  reliability: number; // 0-1, probability of completing work
}

export interface SeedTask {
  id: string;
  description: string;
  serviceType: string;
  estimatedCost: number; // USDC with 6 decimals
  priority: "low" | "medium" | "high";
  stakeRequired: number;
}

const USDC = 1_000_000; // 6 decimals

export const DEMO_PROVIDERS: SeedProvider[] = [
  {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    name: "NovaCoreGPU",
    serviceType: "GPU_COMPUTE",
    endpoint: "https://sim.novacore.gpu/v1",
    stakeAmount: 100 * USDC,
    reliability: 0.95,
  },
  {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    name: "VaultStore",
    serviceType: "STORAGE",
    endpoint: "https://sim.vaultstore.io/v1",
    stakeAmount: 50 * USDC,
    reliability: 0.90,
  },
  {
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    name: "InferenceHub",
    serviceType: "LLM_INFERENCE",
    endpoint: "https://sim.inferencehub.ai/v1",
    stakeAmount: 200 * USDC,
    reliability: 0.85,
  },
  {
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    name: "ApiNexus",
    serviceType: "API_GATEWAY",
    endpoint: "https://sim.apinexus.dev/v1",
    stakeAmount: 30 * USDC,
    reliability: 0.98,
  },
  {
    address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    name: "EdgeRender",
    serviceType: "GPU_COMPUTE",
    endpoint: "https://sim.edgerender.io/v1",
    stakeAmount: 150 * USDC,
    reliability: 0.70, // less reliable — triggers disputes
  },
];

export const DEMO_AGENT = {
  address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`,
  name: "APEX Demo Agent",
  policy: {
    maxSpend: 500 * USDC,
    perTxCap: 25 * USDC,
    dailyCap: 100 * USDC,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  initialBalance: 500 * USDC,
};

export const DEMO_TASKS: SeedTask[] = [
  {
    id: "task-001",
    description: "Train image classifier model (ResNet-50)",
    serviceType: "GPU_COMPUTE",
    estimatedCost: 15 * USDC,
    priority: "high",
    stakeRequired: 10 * USDC,
  },
  {
    id: "task-002",
    description: "Store training dataset (50GB)",
    serviceType: "STORAGE",
    estimatedCost: 5 * USDC,
    priority: "medium",
    stakeRequired: 3 * USDC,
  },
  {
    id: "task-003",
    description: "Run LLM inference batch (GPT-4 equivalent)",
    serviceType: "LLM_INFERENCE",
    estimatedCost: 20 * USDC,
    priority: "high",
    stakeRequired: 15 * USDC,
  },
  {
    id: "task-004",
    description: "Geocoding API — 10k address lookups",
    serviceType: "API_GATEWAY",
    estimatedCost: 3 * USDC,
    priority: "low",
    stakeRequired: 2 * USDC,
  },
  {
    id: "task-005",
    description: "Fine-tune language model on custom corpus",
    serviceType: "GPU_COMPUTE",
    estimatedCost: 22 * USDC,
    priority: "high",
    stakeRequired: 15 * USDC,
  },
  {
    id: "task-006",
    description: "Archive processed results to cold storage",
    serviceType: "STORAGE",
    estimatedCost: 2 * USDC,
    priority: "low",
    stakeRequired: 1 * USDC,
  },
  {
    id: "task-007",
    description: "Summarize 500 research papers",
    serviceType: "LLM_INFERENCE",
    estimatedCost: 18 * USDC,
    priority: "medium",
    stakeRequired: 12 * USDC,
  },
  {
    id: "task-008",
    description: "Real-time sentiment analysis pipeline",
    serviceType: "API_GATEWAY",
    estimatedCost: 8 * USDC,
    priority: "medium",
    stakeRequired: 5 * USDC,
  },
  {
    id: "task-009",
    description: "Generate synthetic training data (10k images)",
    serviceType: "GPU_COMPUTE",
    estimatedCost: 12 * USDC,
    priority: "medium",
    stakeRequired: 8 * USDC,
  },
  {
    id: "task-010",
    description: "Translate documents to 5 languages",
    serviceType: "LLM_INFERENCE",
    estimatedCost: 10 * USDC,
    priority: "low",
    stakeRequired: 7 * USDC,
  },
  {
    id: "task-011",
    description: "Run distributed hyperparameter sweep",
    serviceType: "GPU_COMPUTE",
    estimatedCost: 25 * USDC,
    priority: "high",
    stakeRequired: 18 * USDC,
  },
  {
    id: "task-012",
    description: "Backup model checkpoints (200GB)",
    serviceType: "STORAGE",
    estimatedCost: 8 * USDC,
    priority: "medium",
    stakeRequired: 5 * USDC,
  },
  {
    id: "task-013",
    description: "Webhook delivery service — 50k events",
    serviceType: "API_GATEWAY",
    estimatedCost: 4 * USDC,
    priority: "low",
    stakeRequired: 2 * USDC,
  },
  {
    id: "task-014",
    description: "Extract entities from legal documents",
    serviceType: "LLM_INFERENCE",
    estimatedCost: 14 * USDC,
    priority: "high",
    stakeRequired: 10 * USDC,
  },
  {
    id: "task-015",
    description: "Render 3D scene batch (100 frames)",
    serviceType: "GPU_COMPUTE",
    estimatedCost: 19 * USDC,
    priority: "medium",
    stakeRequired: 12 * USDC,
  },
];

export const FIREWALL_POLICY = {
  flagThreshold: 40,
  approvalThreshold: 70,
  blockThreshold: 90,
  amountWeight: 25,
  stakeWeight: 30,
  frequencyWeight: 20,
  firstPaymentWeight: 25,
  frequencyWindow: 24 * 60 * 60 * 1000, // 1 day in ms
  frequencyLimit: 10,
};

export const MINIMUM_STAKE = 10 * USDC;
