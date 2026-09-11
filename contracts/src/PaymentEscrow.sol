// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPaymentEscrow} from "./interfaces/IPaymentEscrow.sol";
import {IDeliveryVerifier} from "./interfaces/IDeliveryVerifier.sol";
import {IProviderRegistry} from "./interfaces/IProviderRegistry.sol";
import {IStakeManager} from "./interfaces/IStakeManager.sol";
import {IDisputeManager} from "./interfaces/IDisputeManager.sol";

contract PaymentEscrow is IPaymentEscrow, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable paymentToken;

    IProviderRegistry public immutable registry;

    IStakeManager public immutable stakeManager;

    IDeliveryVerifier public immutable deliveryVerifier;

    IDisputeManager public disputeManager;

    address public treasury;

    uint256 public nextJobId;

    mapping(uint256 => Job) private jobs;

    mapping(address => bool) public authorizedCreators;

    // ── Errors ──

    error InvalidProvider();
    error InvalidAmount();
    error InvalidDeadline();
    error InvalidServiceId();
    error InvalidDeliveryHash();
    error InvalidJobId();
    error InvalidAddress();

    error UnauthorizedCreator();

    error ProviderNotEligible();
    error InsufficientProviderStake();

    error JobNotFunded();
    error JobNotWorkSubmitted();
    error JobAlreadySettled();
    error JobAlreadyRefunded();
    error JobAlreadyCancelled();

    error DeadlineNotExpired();
    error DeadlineExpired();

    error OnlyProvider();

    error VerificationFailed();

    error TreasuryNotConfigured();

    error JobDisputed();
    error UnauthorizedDisputeManager();

    // ── Events ──

    event JobCreated(
        uint256 indexed jobId,
        address indexed agent,
        address indexed provider,
        uint256 amount,
        uint256 stakeRequired,
        uint256 deadline,
        bytes32 serviceId
    );

    event DeliverySubmitted(uint256 indexed jobId, address indexed provider, bytes32 deliveryHash);

    event JobSettled(uint256 indexed jobId, address indexed provider, uint256 amount);

    event JobRefunded(uint256 indexed jobId, address indexed agent, uint256 amount);

    event ProviderSlashed(uint256 indexed jobId, address indexed provider, uint256 amount);

    event CreatorAuthorizationUpdated(address indexed creator, bool authorized);

    event TreasuryUpdated(address indexed treasury);

    event DisputeManagerUpdated(address indexed manager);

    event DisputeSettlement(uint256 indexed jobId, bool providerWon, uint256 paymentAmount, uint256 collateralAmount);

    // ── Modifiers ──

    modifier onlyAuthorizedCreator() {
        if (!authorizedCreators[msg.sender]) {
            revert UnauthorizedCreator();
        }

        _;
    }

    // ── Constructor ──

    constructor(
        address initialOwner,
        address paymentToken_,
        address registry_,
        address stakeManager_,
        address deliveryVerifier_,
        address treasury_
    ) Ownable(initialOwner) {
        if (paymentToken_ == address(0)) {
            revert InvalidAddress();
        }

        if (registry_ == address(0)) {
            revert InvalidAddress();
        }

        if (stakeManager_ == address(0)) {
            revert InvalidAddress();
        }

        if (deliveryVerifier_ == address(0)) {
            revert InvalidAddress();
        }

        if (treasury_ == address(0)) {
            revert InvalidAddress();
        }

        paymentToken = IERC20(paymentToken_);
        registry = IProviderRegistry(registry_);
        stakeManager = IStakeManager(stakeManager_);
        deliveryVerifier = IDeliveryVerifier(deliveryVerifier_);
        treasury = treasury_;
    }

    // ── Admin ──

    function setCreatorAuthorization(address creator, bool authorized) external onlyOwner {
        if (creator == address(0)) {
            revert InvalidAddress();
        }

        authorizedCreators[creator] = authorized;

        emit CreatorAuthorizationUpdated(creator, authorized);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) {
            revert InvalidAddress();
        }

        treasury = treasury_;

        emit TreasuryUpdated(treasury_);
    }

    function setDisputeManager(address manager) external onlyOwner {
        if (manager == address(0)) {
            revert InvalidAddress();
        }

        disputeManager = IDisputeManager(manager);

        emit DisputeManagerUpdated(manager);
    }

    // ── Core Operations ──

    function createJob(address provider, uint256 amount, uint256 stakeRequired, uint256 deadline, bytes32 serviceId)
        external
        onlyAuthorizedCreator
        nonReentrant
        returns (uint256 jobId)
    {
        if (provider == address(0)) {
            revert InvalidProvider();
        }

        if (amount == 0) {
            revert InvalidAmount();
        }

        if (deadline <= block.timestamp) {
            revert InvalidDeadline();
        }

        if (serviceId == bytes32(0)) {
            revert InvalidServiceId();
        }

        // Provider must satisfy protocol eligibility:
        // registered + active + minimum stake.
        if (!stakeManager.isEligible(provider)) {
            revert ProviderNotEligible();
        }

        // Provider must also have enough AVAILABLE
        // stake for this job's collateral.
        if (stakeRequired > 0 && stakeManager.availableStake(provider) < stakeRequired) {
            revert InsufficientProviderStake();
        }

        // Lock provider collateral via StakeManager
        if (stakeRequired > 0) {
            stakeManager.lockStake(provider, stakeRequired);
        }

        // Pull payment from the caller (the vault)
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);

        jobId = nextJobId++;

        jobs[jobId] = Job({
            agent: msg.sender,
            provider: provider,
            amount: amount,
            stakeRequired: stakeRequired,
            createdAt: block.timestamp,
            deadline: deadline,
            deliveryAt: 0,
            serviceId: serviceId,
            deliveryHash: bytes32(0),
            status: JobStatus.Funded
        });

        emit JobCreated(jobId, msg.sender, provider, amount, stakeRequired, deadline, serviceId);
    }

    function submitDelivery(uint256 jobId, bytes32 deliveryHash) external {
        Job storage job = _getJobStorage(jobId);

        if (msg.sender != job.provider) {
            revert OnlyProvider();
        }

        if (job.status != JobStatus.Funded) {
            revert JobNotFunded();
        }

        if (block.timestamp >= job.deadline) {
            revert DeadlineExpired();
        }

        if (deliveryHash == bytes32(0)) {
            revert InvalidDeliveryHash();
        }

        job.deliveryHash = deliveryHash;
        job.deliveryAt = block.timestamp;
        job.status = JobStatus.WorkSubmitted;

        emit DeliverySubmitted(jobId, job.provider, deliveryHash);
    }

    function settle(uint256 jobId) external nonReentrant {
        Job storage job = _getJobStorage(jobId);

        if (job.status != JobStatus.WorkSubmitted) {
            revert JobNotWorkSubmitted();
        }

        if (address(disputeManager) != address(0)) {
            if (disputeManager.isDisputed(jobId)) {
                revert JobDisputed();
            }
        }

        // Verify delivery through the pluggable verifier
        bool valid = deliveryVerifier.verify(jobId, job.deliveryHash);

        if (!valid) {
            revert VerificationFailed();
        }

        // CEI: change state BEFORE external calls
        job.status = JobStatus.Settled;

        // Pay the provider
        paymentToken.safeTransfer(job.provider, job.amount);

        // Unlock provider collateral
        if (job.stakeRequired > 0) {
            stakeManager.unlockStake(job.provider, job.stakeRequired);
        }

        emit JobSettled(jobId, job.provider, job.amount);
    }

    function refund(uint256 jobId) external nonReentrant {
        Job storage job = _getJobStorage(jobId);

        if (job.status != JobStatus.Funded) {
            revert JobNotFunded();
        }

        if (block.timestamp < job.deadline) {
            revert DeadlineNotExpired();
        }

        // CEI: change state BEFORE external calls
        job.status = JobStatus.Refunded;

        // Refund payment to the agent
        paymentToken.safeTransfer(job.agent, job.amount);

        // Slash the provider's locked collateral → treasury
        if (job.stakeRequired > 0) {
            stakeManager.slashLocked(job.provider, job.stakeRequired, treasury);

            emit ProviderSlashed(jobId, job.provider, job.stakeRequired);
        }

        emit JobRefunded(jobId, job.agent, job.amount);
    }

    function resolveDispute(uint256 jobId, bool providerWins) external nonReentrant {
        if (msg.sender != address(disputeManager)) {
            revert UnauthorizedDisputeManager();
        }

        Job storage job = _getJobStorage(jobId);

        if (job.status != JobStatus.WorkSubmitted) {
            revert JobNotWorkSubmitted();
        }

        // CEI: change state BEFORE external calls
        job.status = providerWins ? JobStatus.Settled : JobStatus.Refunded;

        if (providerWins) {
            // Pay the provider
            paymentToken.safeTransfer(job.provider, job.amount);

            // Unlock provider collateral
            if (job.stakeRequired > 0) {
                stakeManager.unlockStake(job.provider, job.stakeRequired);
            }

            emit JobSettled(jobId, job.provider, job.amount);
        } else {
            // Agent wins: refund payment to the agent
            paymentToken.safeTransfer(job.agent, job.amount);

            // Slash the provider's locked collateral → treasury
            if (job.stakeRequired > 0) {
                stakeManager.slashLocked(job.provider, job.stakeRequired, treasury);
                emit ProviderSlashed(jobId, job.provider, job.stakeRequired);
            }

            emit JobRefunded(jobId, job.agent, job.amount);
        }

        emit DisputeSettlement(jobId, providerWins, job.amount, job.stakeRequired);
    }

    // ── Views ──

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    // ── Internal ──

    function _getJobStorage(uint256 jobId) internal view returns (Job storage) {
        if (jobId >= nextJobId) {
            revert InvalidJobId();
        }

        return jobs[jobId];
    }
}
