// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IAgentAuthorization} from "./interfaces/IAgentAuthorization.sol";
import {IAgentSpendingVault} from "./interfaces/IAgentSpendingVault.sol";

contract AgentAuthorization is IAgentAuthorization, Ownable, ReentrancyGuard {
    IAgentSpendingVault public immutable spendingVault;

    mapping(address => AgentPolicy) private agentPolicies;
    mapping(address => uint256) private _nonces;

    mapping(bytes32 => bool) public usedRequestIds;

    mapping(address => uint256) public totalSpent;
    mapping(address => uint256) public dailySpent;
    mapping(address => uint256) public dailyWindowStart;

    error InvalidAddress();
    error InvalidPolicy();
    error InvalidAgent();
    error InvalidProvider();
    error InvalidServiceId();
    error InvalidAmount();
    error InvalidRequestId();
    error InvalidDeadline();

    error AgentNotAuthorized();
    error AgentAuthorizationExpired();
    error ProviderNotAuthorized();
    error ServiceNotAuthorized();

    error PerTxCapExceeded();
    error DailyCapExceeded();
    error TotalCapExceeded();

    error RequestAlreadyUsed();
    error InvalidNonce();

    event AgentAuthorized(
        address indexed agent,
        address indexed provider,
        bytes32 indexed serviceId,
        uint256 maxSpend,
        uint256 perTxCap,
        uint256 dailyCap,
        uint256 expiresAt
    );

    event AgentRevoked(address indexed agent);

    event AgentPolicyUpdated(
        address indexed agent,
        address indexed provider,
        bytes32 indexed serviceId,
        uint256 maxSpend,
        uint256 perTxCap,
        uint256 dailyCap,
        uint256 expiresAt
    );

    event PaymentAuthorized(
        address indexed agent, bytes32 indexed requestId, address indexed provider, uint256 amount, uint256 nonce
    );

    constructor(address initialOwner, address spendingVault_) Ownable(initialOwner) {
        if (spendingVault_ == address(0)) {
            revert InvalidAddress();
        }

        spendingVault = IAgentSpendingVault(spendingVault_);
    }

    function authorizeAgent(
        address agent,
        address provider,
        bytes32 serviceId,
        uint256 maxSpend,
        uint256 perTxCap,
        uint256 dailyCap,
        uint256 expiresAt
    ) external onlyOwner {
        _validatePolicy(agent, provider, serviceId, maxSpend, perTxCap, dailyCap, expiresAt);

        agentPolicies[agent] = AgentPolicy({
            authorized: true,
            provider: provider,
            serviceId: serviceId,
            maxSpend: maxSpend,
            perTxCap: perTxCap,
            dailyCap: dailyCap,
            expiresAt: expiresAt
        });

        if (dailyWindowStart[agent] == 0) {
            dailyWindowStart[agent] = block.timestamp;
        }

        emit AgentAuthorized(agent, provider, serviceId, maxSpend, perTxCap, dailyCap, expiresAt);
    }

    function revokeAgent(address agent) external onlyOwner {
        if (agent == address(0)) {
            revert InvalidAgent();
        }

        AgentPolicy storage policy = agentPolicies[agent];

        if (!policy.authorized) {
            revert AgentNotAuthorized();
        }

        policy.authorized = false;

        emit AgentRevoked(agent);
    }

    function updateAgentLimits(
        address agent,
        address provider,
        bytes32 serviceId,
        uint256 maxSpend,
        uint256 perTxCap,
        uint256 dailyCap,
        uint256 expiresAt
    ) external onlyOwner {
        _validatePolicy(agent, provider, serviceId, maxSpend, perTxCap, dailyCap, expiresAt);

        agentPolicies[agent] = AgentPolicy({
            authorized: true,
            provider: provider,
            serviceId: serviceId,
            maxSpend: maxSpend,
            perTxCap: perTxCap,
            dailyCap: dailyCap,
            expiresAt: expiresAt
        });

        emit AgentPolicyUpdated(agent, provider, serviceId, maxSpend, perTxCap, dailyCap, expiresAt);
    }

    function isAuthorized(address agent) external view returns (bool) {
        AgentPolicy memory policy = agentPolicies[agent];

        return policy.authorized && block.timestamp < policy.expiresAt;
    }

    function validateIntent(PaymentIntent calldata intent) public view returns (bool) {
        _validateIntent(intent);
        return true;
    }

    function executePayment(PaymentIntent calldata intent) external nonReentrant returns (uint256 jobId) {
        if (msg.sender != intent.agent) {
            revert AgentNotAuthorized();
        }

        _validateIntent(intent);

        AgentPolicy storage policy = agentPolicies[intent.agent];

        _resetDailyWindowIfNeeded(intent.agent);

        if (intent.amount > policy.perTxCap) {
            revert PerTxCapExceeded();
        }

        if (dailySpent[intent.agent] + intent.amount > policy.dailyCap) {
            revert DailyCapExceeded();
        }

        if (totalSpent[intent.agent] + intent.amount > policy.maxSpend) {
            revert TotalCapExceeded();
        }

        usedRequestIds[intent.requestId] = true;

        _nonces[intent.agent] = intent.nonce + 1;

        totalSpent[intent.agent] += intent.amount;
        dailySpent[intent.agent] += intent.amount;

        jobId = spendingVault.createJob(
            intent.requestId, intent.provider, intent.amount, intent.stakeRequired, intent.deadline, intent.serviceId
        );

        emit PaymentAuthorized(intent.agent, intent.requestId, intent.provider, intent.amount, intent.nonce);
    }

    function nonces(address agent) public view returns (uint256) {
        return _nonces[agent];
    }

    function getAgentPolicy(address agent) external view returns (AgentPolicy memory) {
        return agentPolicies[agent];
    }

    function _validateIntent(PaymentIntent calldata intent) internal view {
        if (intent.requestId == bytes32(0)) {
            revert InvalidRequestId();
        }

        if (intent.agent == address(0)) {
            revert InvalidAgent();
        }

        if (intent.provider == address(0)) {
            revert InvalidProvider();
        }

        if (intent.serviceId == bytes32(0)) {
            revert InvalidServiceId();
        }

        if (intent.amount == 0) {
            revert InvalidAmount();
        }

        if (intent.deadline <= block.timestamp) {
            revert InvalidDeadline();
        }

        if (usedRequestIds[intent.requestId]) {
            revert RequestAlreadyUsed();
        }

        if (intent.nonce != _nonces[intent.agent]) {
            revert InvalidNonce();
        }

        AgentPolicy memory policy = agentPolicies[intent.agent];

        if (!policy.authorized) {
            revert AgentNotAuthorized();
        }

        if (block.timestamp >= policy.expiresAt) {
            revert AgentAuthorizationExpired();
        }

        if (policy.provider != address(0) && policy.provider != intent.provider) {
            revert ProviderNotAuthorized();
        }

        if (policy.serviceId != bytes32(0) && policy.serviceId != intent.serviceId) {
            revert ServiceNotAuthorized();
        }
    }

    function _validatePolicy(
        address agent,
        address provider,
        bytes32 serviceId,
        uint256 maxSpend,
        uint256 perTxCap,
        uint256 dailyCap,
        uint256 expiresAt
    ) internal view {
        if (agent == address(0)) {
            revert InvalidAgent();
        }

        if (provider == address(0)) {
            revert InvalidProvider();
        }

        if (serviceId == bytes32(0)) {
            revert InvalidServiceId();
        }

        if (maxSpend == 0 || perTxCap == 0 || dailyCap == 0) {
            revert InvalidPolicy();
        }

        if (perTxCap > maxSpend) {
            revert InvalidPolicy();
        }

        if (dailyCap > maxSpend) {
            revert InvalidPolicy();
        }

        if (expiresAt <= block.timestamp) {
            revert InvalidPolicy();
        }

        if (totalSpent[agent] > maxSpend) {
            revert InvalidPolicy();
        }
    }

    function _resetDailyWindowIfNeeded(address agent) internal {
        if (block.timestamp >= dailyWindowStart[agent] + 1 days) {
            dailyWindowStart[agent] = block.timestamp;
            dailySpent[agent] = 0;
        }
    }
}
