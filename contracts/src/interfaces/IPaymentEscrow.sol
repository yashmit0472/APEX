// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPaymentEscrow {
    enum JobStatus {
        None,
        Funded,
        WorkSubmitted,
        Settled,
        Refunded,
        Disputed,
        Cancelled
    }

    struct Job {
        address agent;
        address provider;

        uint256 amount;
        uint256 stakeRequired;

        uint256 createdAt;
        uint256 deadline;
        uint256 deliveryAt;

        bytes32 serviceId;
        bytes32 deliveryHash;

        JobStatus status;
    }

    function createJob(address provider, uint256 amount, uint256 stakeRequired, uint256 deadline, bytes32 serviceId)
        external
        returns (uint256 jobId);

    function submitDelivery(uint256 jobId, bytes32 deliveryHash) external;

    function settle(uint256 jobId) external;

    function refund(uint256 jobId) external;

    function resolveDispute(uint256 jobId, bool providerWins) external;

    function getJob(uint256 jobId) external view returns (Job memory);
}
