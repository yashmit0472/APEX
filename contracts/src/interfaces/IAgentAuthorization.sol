// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentAuthorization {
    struct AgentPolicy {
        bool authorized;
        address provider;
        bytes32 serviceId;
        uint256 maxSpend;
        uint256 perTxCap;
        uint256 dailyCap;
        uint256 expiresAt;
    }

    struct PaymentIntent {
        bytes32 requestId;
        address agent;
        address provider;
        uint256 amount;
        bytes32 serviceId;
        uint256 deadline;
        uint256 nonce;
        uint256 stakeRequired;
    }

    function authorizeAgent(
        address agent,
        address provider,
        bytes32 serviceId,
        uint256 maxSpend,
        uint256 perTxCap,
        uint256 dailyCap,
        uint256 expiresAt
    ) external;

    function revokeAgent(address agent) external;

    function updateAgentLimits(
        address agent,
        address provider,
        bytes32 serviceId,
        uint256 maxSpend,
        uint256 perTxCap,
        uint256 dailyCap,
        uint256 expiresAt
    ) external;

    function isAuthorized(address agent) external view returns (bool);

    function validateIntent(PaymentIntent calldata intent) external view returns (bool);

    function executePayment(PaymentIntent calldata intent) external returns (uint256 jobId);

    function nonces(address agent) external view returns (uint256);

    function getAgentPolicy(address agent) external view returns (AgentPolicy memory);
    function setRouterAuthorization(address router, bool authorized) external;
}
