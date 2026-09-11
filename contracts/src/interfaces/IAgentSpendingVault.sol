// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentSpendingVault {
    struct Policy {
        uint256 maxSpend;
        uint256 perTxCap;
        uint256 dailyCap;
    }

    function createJob(
        bytes32 requestId,
        address provider,
        uint256 amount,
        uint256 stakeRequired,
        uint256 deadline,
        bytes32 serviceId
    ) external returns (uint256 jobId);
    function remainingAllowance() external view returns (uint256);
    function remainingDailyAllowance() external view returns (uint256);
    function policy() external view returns (Policy memory);
}
