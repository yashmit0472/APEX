// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IStakeManager} from "./interfaces/IStakeManager.sol";

contract AgentSpendingVault is
    Ownable,
    ReentrancyGuard,
    Pausable
{
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public agent;
    IStakeManager public stakeManager;

    struct Policy {
        uint256 maxSpend;
        uint256 perTxCap;
        uint256 dailyCap;
    }

    Policy public policy;

    uint256 public totalSpent;
    uint256 public dailySpent;
    uint256 public dailyWindowStart;

    mapping(address => bool) public approvedProviders;
    mapping(bytes32 => bool) public usedRequestIds;

    event AgentUpdated(
        address indexed oldAgent,
        address indexed newAgent
    );

    event PolicyUpdated(
        uint256 maxSpend,
        uint256 perTxCap,
        uint256 dailyCap
    );

    event ProviderApprovalUpdated(
        address indexed provider,
        bool approved
    );

    event FundsDeposited(
        address indexed from,
        uint256 amount
    );

    event FundsWithdrawn(
        address indexed to,
        uint256 amount
    );

    event PaymentExecuted(
        bytes32 indexed requestId,
        address indexed provider,
        uint256 amount
    );

    event EmergencyPauseUpdated(bool paused);

    event StakeManagerUpdated(
        address indexed manager
    );

    error InvalidAgent();
    error InvalidProvider();
    error InvalidAmount();
    error InvalidPolicy();
    error UnauthorizedAgent();
    error ProviderNotApproved();
    error TotalCapExceeded();
    error PerTxCapExceeded();
    error DailyCapExceeded();
    error InsufficientVaultBalance();
    error RequestAlreadyUsed();
    error StakeManagerNotConfigured();
    error ProviderNotEligible();

    constructor(
        address initialOwner,
        address usdcToken,
        address initialAgent
    ) Ownable(initialOwner) {
        if (usdcToken == address(0)) {
            revert InvalidProvider();
        }

        if (initialAgent == address(0)) {
            revert InvalidAgent();
        }

        usdc = IERC20(usdcToken);
        agent = initialAgent;
        dailyWindowStart = block.timestamp;
    }

    modifier onlyAgent() {
        if (msg.sender != agent) {
            revert UnauthorizedAgent();
        }

        _;
    }

    function setAgent(
        address newAgent
    ) external onlyOwner {
        if (newAgent == address(0)) {
            revert InvalidAgent();
        }

        address oldAgent = agent;

        agent = newAgent;

        emit AgentUpdated(
            oldAgent,
            newAgent
        );
    }

    function setPolicy(
        uint256 maxSpend,
        uint256 perTxCap,
        uint256 dailyCap
    ) external onlyOwner {
        if (
            maxSpend == 0 ||
            perTxCap == 0 ||
            dailyCap == 0
        ) {
            revert InvalidPolicy();
        }

        if (perTxCap > maxSpend) {
            revert InvalidPolicy();
        }

        if (dailyCap > maxSpend) {
            revert InvalidPolicy();
        }

        if (totalSpent > maxSpend) {
            revert InvalidPolicy();
        }

        policy = Policy({
            maxSpend: maxSpend,
            perTxCap: perTxCap,
            dailyCap: dailyCap
        });

        emit PolicyUpdated(
            maxSpend,
            perTxCap,
            dailyCap
        );
    }

    function setProviderApproval(
        address provider,
        bool approved
    ) external onlyOwner {
        if (provider == address(0)) {
            revert InvalidProvider();
        }

        approvedProviders[provider] = approved;

        emit ProviderApprovalUpdated(
            provider,
            approved
        );
    }

    function deposit(
        uint256 amount
    ) external onlyOwner nonReentrant {
        if (amount == 0) {
            revert InvalidAmount();
        }

        usdc.safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        emit FundsDeposited(
            msg.sender,
            amount
        );
    }

    function withdraw(
        address to,
        uint256 amount
    ) external onlyOwner nonReentrant {
        if (to == address(0)) {
            revert InvalidProvider();
        }

        if (amount == 0) {
            revert InvalidAmount();
        }

        uint256 balance =
            usdc.balanceOf(address(this));

        if (amount > balance) {
            revert InsufficientVaultBalance();
        }

        usdc.safeTransfer(to, amount);

        emit FundsWithdrawn(
            to,
            amount
        );
    }

    function pay(
    bytes32 requestId,
    address provider,
    uint256 amount
)
    external
    onlyAgent
    whenNotPaused
    nonReentrant
{
    if (requestId == bytes32(0)) {
        revert InvalidAmount();
    }

    if (provider == address(0)) {
        revert InvalidProvider();
    }

    if (amount == 0) {
        revert InvalidAmount();
    }

    if (usedRequestIds[requestId]) {
        revert RequestAlreadyUsed();
    }

   if (address(stakeManager) == address(0)) {
    revert StakeManagerNotConfigured();
}
if (!stakeManager.isEligible(provider)) {
    revert ProviderNotEligible();
}

    _resetDailyWindowIfNeeded();

    if (amount > policy.perTxCap) {
        revert PerTxCapExceeded();
    }

    if (totalSpent + amount > policy.maxSpend) {
        revert TotalCapExceeded();
    }

    if (dailySpent + amount > policy.dailyCap) {
        revert DailyCapExceeded();
    }

    uint256 balance = usdc.balanceOf(address(this));

    if (amount > balance) {
        revert InsufficientVaultBalance();
    }

    usedRequestIds[requestId] = true;

    totalSpent += amount;
    dailySpent += amount;

    usdc.safeTransfer(
        provider,
        amount
    );

    emit PaymentExecuted(
        requestId,
        provider,
        amount
    );
}

    function remainingAllowance()
        public
        view
        returns (uint256)
    {
        if (totalSpent >= policy.maxSpend) {
            return 0;
        }

        return policy.maxSpend - totalSpent;
    }

    function remainingDailyAllowance()
        public
        view
        returns (uint256)
    {
        uint256 currentDailySpent = dailySpent;

        if (
            block.timestamp >=
            dailyWindowStart + 1 days
        ) {
            currentDailySpent = 0;
        }

        if (
            currentDailySpent >= policy.dailyCap
        ) {
            return 0;
        }

        return
            policy.dailyCap -
            currentDailySpent;
    }

    function pause() external onlyOwner {
        _pause();

        emit EmergencyPauseUpdated(true);
    }

    function unpause() external onlyOwner {
        _unpause();

        emit EmergencyPauseUpdated(false);
    }

    function setStakeManager(
        address manager
    ) external onlyOwner {
        if (manager == address(0)) {
            revert InvalidProvider();
        }

        stakeManager = IStakeManager(manager);

        emit StakeManagerUpdated(manager);
    }

    function _resetDailyWindowIfNeeded()
        internal
    {
        if (
            block.timestamp >=
            dailyWindowStart + 1 days
        ) {
            dailyWindowStart = block.timestamp;
            dailySpent = 0;
        }
    }
}