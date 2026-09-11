// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IAgentSpendingVault} from "./interfaces/IAgentSpendingVault.sol";
import {IStakeManager} from "./interfaces/IStakeManager.sol";
import {IPaymentFirewall} from "./interfaces/IPaymentFirewall.sol";

contract PaymentFirewall is IPaymentFirewall, Ownable {
    uint256 private constant MAX_SCORE = 100;
    uint256 private constant BASIS_POINTS = 10_000;

    IAgentSpendingVault public immutable spendingVault;
    IStakeManager public immutable stakeManager;

    uint256 public flagThreshold;
    uint256 public approvalThreshold;
    uint256 public blockThreshold;

    uint256 public amountWeight;
    uint256 public stakeWeight;
    uint256 public frequencyWeight;
    uint256 public firstPaymentWeight;
    uint256 public frequencyWindow;
    uint256 public frequencyLimit;

    mapping(bytes32 => PendingRequest) private pendingRequests;
    mapping(address => uint256[]) private providerRequestTimes;
    mapping(address => mapping(address => bool)) public hasSuccessfulPayment;
    mapping(address => bool) public authorizedRecorders;

    error InvalidAddress();
    error InvalidAmount();
    error InvalidRequestId();
    error InvalidThresholds();
    error InvalidWeights();
    error InvalidFrequencyPolicy();
    error RequestBlocked(uint256 score);
    error RequestAlreadyPending(bytes32 requestId);
    error NotPending(bytes32 requestId);
    error UnauthorizedRecorder();

    event RiskEvaluated(bytes32 indexed requestId, uint256 score, Decision decision);
    event RiskFlagged(bytes32 indexed requestId, uint256 score);
    event RequestApproved(bytes32 indexed requestId);
    event RequestRejected(bytes32 indexed requestId);
    event PolicyUpdated(
        uint256 flagThreshold,
        uint256 approvalThreshold,
        uint256 blockThreshold,
        uint256 amountWeight,
        uint256 stakeWeight,
        uint256 frequencyWeight,
        uint256 firstPaymentWeight,
        uint256 frequencyWindow,
        uint256 frequencyLimit
    );
    event RecorderAuthorizationUpdated(address indexed recorder, bool authorized);

    constructor(address initialOwner, address spendingVault_, address stakeManager_) Ownable(initialOwner) {
        if (spendingVault_ == address(0) || stakeManager_ == address(0)) {
            revert InvalidAddress();
        }

        spendingVault = IAgentSpendingVault(spendingVault_);
        stakeManager = IStakeManager(stakeManager_);

        flagThreshold = 40;
        approvalThreshold = 70;
        blockThreshold = 90;
        amountWeight = 25;
        stakeWeight = 30;
        frequencyWeight = 20;
        firstPaymentWeight = 25;
        frequencyWindow = 1 days;
        frequencyLimit = 10;
    }

    function setPolicy(
        uint256 flagThreshold_,
        uint256 approvalThreshold_,
        uint256 blockThreshold_,
        uint256 amountWeight_,
        uint256 stakeWeight_,
        uint256 frequencyWeight_,
        uint256 firstPaymentWeight_,
        uint256 frequencyWindow_,
        uint256 frequencyLimit_
    ) external onlyOwner {
        if (
            flagThreshold_ == 0 || flagThreshold_ >= approvalThreshold_ || approvalThreshold_ >= blockThreshold_
                || blockThreshold_ > MAX_SCORE
        ) {
            revert InvalidThresholds();
        }

        if (amountWeight_ + stakeWeight_ + frequencyWeight_ + firstPaymentWeight_ == 0) {
            revert InvalidWeights();
        }

        if (frequencyWindow_ == 0 || frequencyLimit_ == 0) {
            revert InvalidFrequencyPolicy();
        }

        flagThreshold = flagThreshold_;
        approvalThreshold = approvalThreshold_;
        blockThreshold = blockThreshold_;
        amountWeight = amountWeight_;
        stakeWeight = stakeWeight_;
        frequencyWeight = frequencyWeight_;
        firstPaymentWeight = firstPaymentWeight_;
        frequencyWindow = frequencyWindow_;
        frequencyLimit = frequencyLimit_;

        emit PolicyUpdated(
            flagThreshold_,
            approvalThreshold_,
            blockThreshold_,
            amountWeight_,
            stakeWeight_,
            frequencyWeight_,
            firstPaymentWeight_,
            frequencyWindow_,
            frequencyLimit_
        );
    }

    function setRecorderAuthorization(address recorder, bool authorized) external onlyOwner {
        if (recorder == address(0)) {
            revert InvalidAddress();
        }

        authorizedRecorders[recorder] = authorized;

        emit RecorderAuthorizationUpdated(recorder, authorized);
    }

    function evaluate(address agent, address provider, uint256 amount, bytes32 requestId)
        external
        returns (uint256 score, Decision decision)
    {
        if (!authorizedRecorders[msg.sender]) {
            revert UnauthorizedRecorder();
        }

        if (agent == address(0)) {
            revert InvalidAddress();
        }

        if (provider == address(0)) {
            revert InvalidAddress();
        }

        if (amount == 0) {
            revert InvalidAmount();
        }

        if (requestId == bytes32(0)) {
            revert InvalidRequestId();
        }

        PendingRequest storage existing = pendingRequests[requestId];
        if (existing.status == PendingStatus.Pending) {
            revert RequestAlreadyPending(requestId);
        }

        uint256 amountRisk = _amountRisk(amount);
        uint256 stakeRisk = _stakeRisk(provider, amount);
        uint256 frequencyRisk = _frequencyRisk(provider);
        uint256 firstPaymentRisk = hasSuccessfulPayment[agent][provider] ? 0 : MAX_SCORE;
        uint256 totalWeight = amountWeight + stakeWeight + frequencyWeight + firstPaymentWeight;

        score =
            (amountRisk
                    * amountWeight
                    + stakeRisk
                    * stakeWeight
                    + frequencyRisk
                    * frequencyWeight
                    + firstPaymentRisk
                    * firstPaymentWeight) / totalWeight;

        decision = _decisionFor(score);
        providerRequestTimes[provider].push(block.timestamp);

        if (decision == Decision.REQUIRE_APPROVAL) {
            pendingRequests[requestId] = PendingRequest({
                requestId: requestId,
                agent: agent,
                provider: provider,
                amount: amount,
                score: score,
                timestamp: block.timestamp,
                status: PendingStatus.Pending
            });
        }

        emit RiskEvaluated(requestId, score, decision);

        if (decision == Decision.FLAG) {
            emit RiskFlagged(requestId, score);
        }

        if (decision == Decision.BLOCK) {
            revert RequestBlocked(score);
        }
    }

    function approveRequest(bytes32 requestId) external onlyOwner {
        PendingRequest storage request = pendingRequests[requestId];
        if (request.status != PendingStatus.Pending) {
            revert NotPending(requestId);
        }

        request.status = PendingStatus.Approved;
        emit RequestApproved(requestId);
    }

    function rejectRequest(bytes32 requestId) external onlyOwner {
        PendingRequest storage request = pendingRequests[requestId];
        if (request.status != PendingStatus.Pending) {
            revert NotPending(requestId);
        }

        request.status = PendingStatus.Rejected;
        emit RequestRejected(requestId);
    }

    function recordSuccessfulPayment(address agent, address provider) external {
        if (!authorizedRecorders[msg.sender]) {
            revert UnauthorizedRecorder();
        }

        if (agent == address(0) || provider == address(0)) {
            revert InvalidAddress();
        }

        hasSuccessfulPayment[agent][provider] = true;
    }

    function isRequestApproved(bytes32 requestId) external view returns (bool) {
        return pendingRequests[requestId].status == PendingStatus.Approved;
    }

    function getPendingRequest(bytes32 requestId) external view returns (PendingRequest memory) {
        return pendingRequests[requestId];
    }

    function _amountRisk(uint256 amount) internal view returns (uint256) {
        uint256 remainingTotal = spendingVault.remainingAllowance();
        uint256 remainingDaily = spendingVault.remainingDailyAllowance();
        IAgentSpendingVault.Policy memory vaultPolicy = spendingVault.policy();
        uint256 remainingPerTx = vaultPolicy.perTxCap;
        uint256 available = remainingPerTx;

        if (remainingDaily < available) {
            available = remainingDaily;
        }

        if (remainingTotal < available) {
            available = remainingTotal;
        }

        if (available == 0) {
            return MAX_SCORE;
        }

        uint256 risk = amount * MAX_SCORE / available;
        return risk > MAX_SCORE ? MAX_SCORE : risk;
    }

    function _stakeRisk(address provider, uint256 amount) internal view returns (uint256) {
        uint256 available = stakeManager.availableStake(provider);
        if (available == 0) {
            return MAX_SCORE;
        }

        if (available >= amount) {
            return 0;
        }

        uint256 risk = (amount - available) * MAX_SCORE / amount;
        return risk > MAX_SCORE ? MAX_SCORE : risk;
    }

    function _frequencyRisk(address provider) internal view returns (uint256) {
        uint256[] storage requestTimes = providerRequestTimes[provider];
        uint256 cutoff = block.timestamp > frequencyWindow ? block.timestamp - frequencyWindow : 0;
        uint256 recentRequests;

        for (uint256 index = requestTimes.length; index > 0; index--) {
            if (requestTimes[index - 1] < cutoff) {
                break;
            }
            recentRequests++;
        }

        uint256 risk = recentRequests * MAX_SCORE / frequencyLimit;
        return risk > MAX_SCORE ? MAX_SCORE : risk;
    }

    function _decisionFor(uint256 score) internal view returns (Decision) {
        if (score < flagThreshold) {
            return Decision.AUTO_PAY;
        }

        if (score < approvalThreshold) {
            return Decision.FLAG;
        }

        if (score < blockThreshold) {
            return Decision.REQUIRE_APPROVAL;
        }

        return Decision.BLOCK;
    }
}
