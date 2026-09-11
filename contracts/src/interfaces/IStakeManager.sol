// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IStakeManager {
    function stake(uint256 amount) external;
    function withdrawStake(uint256 amount) external;
    function lockStake(address provider, uint256 amount) external;
    function unlockStake(address provider, uint256 amount) external;
    function slash(address provider, uint256 amount, address recipient) external;
    function slashLocked(address provider, uint256 amount, address recipient) external;
    function stakedBalance(address provider) external view returns (uint256);
    function lockedBalance(address provider) external view returns (uint256);
    function availableStake(address provider) external view returns (uint256);
    function isEligible(address provider) external view returns (bool);
}
