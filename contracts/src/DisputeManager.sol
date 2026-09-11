// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IDisputeManager} from "./interfaces/IDisputeManager.sol";
import {IPaymentEscrow} from "./interfaces/IPaymentEscrow.sol";

contract DisputeManager is IDisputeManager, Ownable {
    address public arbitrator;
    uint256 public disputeWindow;

    IPaymentEscrow public paymentEscrow;

    mapping(uint256 => Dispute) private disputes;

    error InvalidArbitrator();
    error InvalidPaymentEscrow();
    error InvalidEvidence();
    error Unauthorized();
    error JobNotWorkSubmitted();
    error DisputeAlreadyExists();
    error DisputeWindowExpired();
    error DisputeNotFound();
    error DisputeNotOpen();

    event ArbitratorUpdated(address indexed arbitrator);
    event DisputeWindowUpdated(uint256 disputeWindow);
    event PaymentEscrowUpdated(address indexed paymentEscrow);
    event DisputeOpened(uint256 indexed jobId, address indexed agent, bytes32 evidenceHash);
    event DisputeResolved(uint256 indexed jobId, DisputeStatus resolution);

    modifier onlyArbitrator() {
        if (msg.sender != arbitrator) {
            revert Unauthorized();
        }
        _;
    }

    constructor(address initialOwner, address _arbitrator, uint256 _disputeWindow) Ownable(initialOwner) {
        if (_arbitrator == address(0)) revert InvalidArbitrator();
        arbitrator = _arbitrator;
        disputeWindow = _disputeWindow;
    }

    function setArbitrator(address newArbitrator) external onlyOwner {
        if (newArbitrator == address(0)) revert InvalidArbitrator();
        arbitrator = newArbitrator;
        emit ArbitratorUpdated(arbitrator);
    }

    function setDisputeWindow(uint256 newWindow) external onlyOwner {
        disputeWindow = newWindow;
        emit DisputeWindowUpdated(disputeWindow);
    }

    function setPaymentEscrow(address _paymentEscrow) external onlyOwner {
        if (_paymentEscrow == address(0)) revert InvalidPaymentEscrow();
        paymentEscrow = IPaymentEscrow(_paymentEscrow);
        emit PaymentEscrowUpdated(_paymentEscrow);
    }

    function openDispute(uint256 jobId, bytes32 evidenceHash) external {
        if (address(paymentEscrow) == address(0)) revert InvalidPaymentEscrow();
        if (evidenceHash == bytes32(0)) revert InvalidEvidence();

        IPaymentEscrow.Job memory job = paymentEscrow.getJob(jobId);

        if (msg.sender != job.agent) revert Unauthorized();
        if (uint8(job.status) != uint8(IPaymentEscrow.JobStatus.WorkSubmitted)) {
            revert JobNotWorkSubmitted();
        }

        if (block.timestamp > job.deliveryAt + disputeWindow) {
            revert DisputeWindowExpired();
        }

        Dispute storage dispute = disputes[jobId];
        if (dispute.status != DisputeStatus.None) revert DisputeAlreadyExists();

        dispute.jobId = jobId;
        dispute.initiator = msg.sender;
        dispute.createdAt = block.timestamp;
        dispute.resolutionDeadline = block.timestamp + 48 hours; // Example resolution deadline from prompt
        dispute.status = DisputeStatus.Open;
        dispute.evidenceHash = evidenceHash;

        emit DisputeOpened(jobId, msg.sender, evidenceHash);
    }

    function isDisputed(uint256 jobId) external view returns (bool) {
        return disputes[jobId].status == DisputeStatus.Open;
    }

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
        )
    {
        Dispute memory dispute = disputes[jobId];
        return (
            dispute.jobId,
            dispute.initiator,
            dispute.createdAt,
            dispute.resolutionDeadline,
            dispute.status,
            dispute.evidenceHash
        );
    }

    function resolveProviderWins(uint256 jobId) external onlyArbitrator {
        Dispute storage dispute = disputes[jobId];
        if (dispute.status == DisputeStatus.None) revert DisputeNotFound();
        if (dispute.status != DisputeStatus.Open) revert DisputeNotOpen();

        dispute.status = DisputeStatus.ProviderWins;
        emit DisputeResolved(jobId, DisputeStatus.ProviderWins);

        paymentEscrow.resolveDispute(jobId, true);
    }

    function resolveAgentWins(uint256 jobId) external onlyArbitrator {
        Dispute storage dispute = disputes[jobId];
        if (dispute.status == DisputeStatus.None) revert DisputeNotFound();
        if (dispute.status != DisputeStatus.Open) revert DisputeNotOpen();

        dispute.status = DisputeStatus.AgentWins;
        emit DisputeResolved(jobId, DisputeStatus.AgentWins);

        paymentEscrow.resolveDispute(jobId, false);
    }
}
