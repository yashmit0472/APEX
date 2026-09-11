// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDisputeManager {
    enum DisputeStatus {
        None,
        Open,
        ProviderWins,
        AgentWins,
        Cancelled
    }

    struct Dispute {
        uint256 jobId;
        address initiator;
        uint256 createdAt;
        uint256 resolutionDeadline;
        DisputeStatus status;
        bytes32 evidenceHash;
    }

    function openDispute(uint256 jobId, bytes32 evidenceHash) external;

    function isDisputed(uint256 jobId) external view returns (bool);

    function getDispute(uint256 jobId)
        external
        view
        returns (
            uint256 id,
            address initiator,
            uint256 createdAt,
            uint256 resolutionDeadline,
            DisputeStatus status,
            bytes32 evidenceHash
        );
}
