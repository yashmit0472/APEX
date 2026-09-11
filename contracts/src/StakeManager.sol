// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IProviderRegistry} from "./interfaces/IProviderRegistry.sol";

contract StakeManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable stakeToken;
    IProviderRegistry public immutable registry;
    uint256 public immutable minimumStake;

    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public lockedBalance;
    mapping(address => bool) public authorizedLockers;

    error InvalidProvider();
    error InvalidAmount();
    error ProviderNotRegistered();
    error ProviderNotActive();
    error InsufficientStake();
    error InsufficientAvailableStake();
    error UnauthorizedLocker();
    error InvalidRecipient();

    event StakeDeposited(
        address indexed provider,
        uint256 amount
    );

    event StakeWithdrawn(
        address indexed provider,
        uint256 amount
    );

    event StakeLocked(
        address indexed provider,
        uint256 amount
    );

    event StakeUnlocked(
        address indexed provider,
        uint256 amount
    );

    event StakeSlashed(
        address indexed provider,
        uint256 amount,
        address indexed recipient
    );

    event LockerAuthorizationUpdated(
        address indexed locker,
        bool authorized
    );

    constructor(
        address initialOwner,
        address stakeToken_,
        address registry_,
        uint256 minimumStake_
    ) Ownable(initialOwner) {
        if (stakeToken_ == address(0)) {
            revert InvalidProvider();
        }

        if (registry_ == address(0)) {
            revert InvalidProvider();
        }

        if (minimumStake_ == 0) {
            revert InvalidAmount();
        }

        stakeToken = IERC20(stakeToken_);
        registry = IProviderRegistry(registry_);
        minimumStake = minimumStake_;
    }

    modifier onlyAuthorizedLocker() {
        if (!authorizedLockers[msg.sender]) {
            revert UnauthorizedLocker();
        }

        _;
    }

    function setLockerAuthorization(
        address locker,
        bool authorized
    ) external onlyOwner {
        if (locker == address(0)) {
            revert InvalidProvider();
        }

        authorizedLockers[locker] = authorized;

        emit LockerAuthorizationUpdated(
            locker,
            authorized
        );
    }

    function stake(
        uint256 amount
    ) external nonReentrant {
        if (amount == 0) {
            revert InvalidAmount();
        }

        if (!registry.isRegistered(msg.sender)) {
            revert ProviderNotRegistered();
        }

        if (!registry.isActive(msg.sender)) {
            revert ProviderNotActive();
        }

        stakeToken.safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        stakedBalance[msg.sender] += amount;

        emit StakeDeposited(
            msg.sender,
            amount
        );
    }

    function withdrawStake(
        uint256 amount
    ) external nonReentrant {
        if (amount == 0) {
            revert InvalidAmount();
        }

        uint256 available = availableStake(msg.sender);

        if (amount > available) {
            revert InsufficientAvailableStake();
        }

        uint256 remaining = stakedBalance[msg.sender] - amount;

        if (
            remaining < minimumStake &&
            remaining != 0
        ) {
            revert InsufficientStake();
        }

        stakedBalance[msg.sender] -= amount;

        stakeToken.safeTransfer(
            msg.sender,
            amount
        );

        emit StakeWithdrawn(
            msg.sender,
            amount
        );
    }

    function lockStake(
        address provider,
        uint256 amount
    ) external onlyAuthorizedLocker {
        if (provider == address(0)) {
            revert InvalidProvider();
        }

        if (amount == 0) {
            revert InvalidAmount();
        }

        uint256 available = availableStake(provider);

        if (amount > available) {
            revert InsufficientAvailableStake();
        }

        lockedBalance[provider] += amount;

        emit StakeLocked(
            provider,
            amount
        );
    }

    function unlockStake(
        address provider,
        uint256 amount
    ) external onlyAuthorizedLocker {
        if (provider == address(0)) {
            revert InvalidProvider();
        }

        if (amount == 0) {
            revert InvalidAmount();
        }

        if (amount > lockedBalance[provider]) {
            revert InsufficientStake();
        }

        lockedBalance[provider] -= amount;

        emit StakeUnlocked(
            provider,
            amount
        );
    }

    function slash(
        address provider,
        uint256 amount,
        address recipient
    ) external onlyAuthorizedLocker nonReentrant {
        if (provider == address(0)) {
            revert InvalidProvider();
        }

        if (recipient == address(0)) {
            revert InvalidRecipient();
        }

        if (amount == 0) {
            revert InvalidAmount();
        }

        uint256 available = availableStake(provider);

        if (amount > available) {
            revert InsufficientAvailableStake();
        }

        stakedBalance[provider] -= amount;

        stakeToken.safeTransfer(
            recipient,
            amount
        );

        emit StakeSlashed(
            provider,
            amount,
            recipient
        );
    }

    function availableStake(
        address provider
    ) public view returns (uint256) {
        return
            stakedBalance[provider] -
            lockedBalance[provider];
    }

    function isEligible(
        address provider
    ) public view returns (bool) {
        if (!registry.isRegistered(provider)) {
            return false;
        }

        if (!registry.isActive(provider)) {
            return false;
        }

        if (stakedBalance[provider] < minimumStake) {
            return false;
        }

        return true;
    }
}