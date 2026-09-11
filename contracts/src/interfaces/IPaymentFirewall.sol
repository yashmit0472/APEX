// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPaymentFirewall {
    enum Decision {
        AUTO_PAY,
        FLAG,
        REQUIRE_APPROVAL,
        BLOCK
    }

    enum PendingStatus {
        None,
        Pending,
        Approved,
        Rejected
    }

    struct PendingRequest {
        bytes32 requestId;
        address agent;
        address provider;
        uint256 amount;
        uint256 score;
        uint256 timestamp;
        PendingStatus status;
    }

    function evaluate(address agent, address provider, uint256 amount, bytes32 requestId)
        external
        returns (uint256 score, Decision decision);

    function approveRequest(bytes32 requestId) external;

    function rejectRequest(bytes32 requestId) external;

    function recordSuccessfulPayment(address agent, address provider) external;

    function isRequestApproved(bytes32 requestId) external view returns (bool);

    function getPendingRequest(bytes32 requestId) external view returns (PendingRequest memory);
}
