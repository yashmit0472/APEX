export const agentAuthorizationAbi = [
  {
    type: "function",
    name: "validatePaymentIntent",
    stateMutability: "view",
    inputs: [
      {
        name: "agent",
        type: "address"
      },
      {
        name: "provider",
        type: "address"
      },
      {
        name: "amount",
        type: "uint256"
      },
      {
        name: "serviceType",
        type: "string"
      },
      {
        name: "requestId",
        type: "bytes32"
      }
    ],
    outputs: [
      {
        name: "authorized",
        type: "bool"
      }
    ]
  }
] as const;

export const agentSpendingVaultAbi = [
  {
    type: "function",
    name: "pay",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "requestId",
        type: "bytes32"
      },
      {
        name: "provider",
        type: "address"
      },
      {
        name: "amount",
        type: "uint256"
      }
    ],
    outputs: []
  }
] as const;

export const paymentEscrowAbi = [
  {
    type: "function",
    name: "createJob",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "requestId",
        type: "bytes32"
      },
      {
        name: "provider",
        type: "address"
      },
      {
        name: "amount",
        type: "uint256"
      }
    ],
    outputs: [
      {
        name: "jobId",
        type: "bytes32"
      }
    ]
  }
] as const;