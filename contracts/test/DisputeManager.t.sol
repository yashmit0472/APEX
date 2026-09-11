// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PaymentEscrow} from "../src/PaymentEscrow.sol";
import {DeliveryVerifier} from "../src/DeliveryVerifier.sol";
import {StakeManager} from "../src/StakeManager.sol";
import {ProviderRegistry} from "../src/ProviderRegistry.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {DisputeManager} from "../src/DisputeManager.sol";
import {IDisputeManager} from "../src/interfaces/IDisputeManager.sol";
import {IPaymentEscrow} from "../src/interfaces/IPaymentEscrow.sol";

contract DisputeManagerTest is Test {
    MockUSDC token;
    ProviderRegistry registry;
    StakeManager stakeManager;
    DeliveryVerifier verifier;
    PaymentEscrow escrow;
    DisputeManager disputeManager;

    address owner = address(1);
    address vault = address(2);
    address provider = address(3);
    address attacker = address(4);
    address treasury = address(5);
    address arbitrator = address(6);

    uint256 constant ONE_USDC = 1_000_000;
    uint256 constant MINIMUM_STAKE = 10_000_000;
    uint256 constant DISPUTE_WINDOW = 24 hours;

    bytes32 constant SERVICE_ID = keccak256("GPU_COMPUTE");
    bytes32 constant DELIVERY_HASH = keccak256("result_v1");
    bytes32 constant EVIDENCE_HASH = keccak256("evidence_v1");

    function setUp() public {
        token = new MockUSDC();
        registry = new ProviderRegistry(owner);
        stakeManager = new StakeManager(owner, address(token), address(registry), MINIMUM_STAKE);
        verifier = new DeliveryVerifier();
        escrow = new PaymentEscrow(
            owner, address(token), address(registry), address(stakeManager), address(verifier), treasury
        );
        disputeManager = new DisputeManager(owner, arbitrator, DISPUTE_WINDOW);

        vm.startPrank(owner);
        escrow.setCreatorAuthorization(vault, true);
        escrow.setDisputeManager(address(disputeManager));
        stakeManager.setLockerAuthorization(address(escrow), true);
        disputeManager.setPaymentEscrow(address(escrow));
        vm.stopPrank();

        vm.prank(provider);
        registry.registerProvider("GPU", "https://gpu.example");

        token.mint(provider, 1_000 * ONE_USDC);

        vm.prank(provider);
        token.approve(address(stakeManager), type(uint256).max);

        vm.prank(provider);
        stakeManager.stake(100 * ONE_USDC);

        token.mint(vault, 1_000 * ONE_USDC);

        vm.prank(vault);
        token.approve(address(escrow), type(uint256).max);
    }

    // ── Helpers ──

    function _createAndSubmitJob() internal returns (uint256 jobId) {
        vm.prank(vault);
        jobId = escrow.createJob(provider, 25 * ONE_USDC, 10 * ONE_USDC, block.timestamp + 2 hours, SERVICE_ID);

        vm.prank(provider);
        escrow.submitDelivery(jobId, DELIVERY_HASH);
    }

    // ── Deployment ──

    function testConstructorWorks() public {
        assertEq(disputeManager.arbitrator(), arbitrator);
        assertEq(disputeManager.disputeWindow(), DISPUTE_WINDOW);
        assertEq(address(disputeManager.paymentEscrow()), address(escrow));
    }

    function testConstructorRevertsZeroArbitrator() public {
        vm.expectRevert(DisputeManager.InvalidArbitrator.selector);
        new DisputeManager(owner, address(0), DISPUTE_WINDOW);
    }

    // ── Opening ──

    function testAgentCanOpenDispute() public {
        uint256 jobId = _createAndSubmitJob();

        vm.prank(vault);
        disputeManager.openDispute(jobId, EVIDENCE_HASH);

        assertTrue(disputeManager.isDisputed(jobId));

        (
            uint256 id,
            address initiator,, // createdAt
            , // resolutionDeadline
            IDisputeManager.DisputeStatus status,
            bytes32 evidence
        ) = disputeManager.getDispute(jobId);

        assertEq(id, jobId);
        assertEq(initiator, vault);
        assertEq(uint8(status), uint8(IDisputeManager.DisputeStatus.Open));
        assertEq(evidence, EVIDENCE_HASH);
    }

    function testProviderCannotOpen() public {
        uint256 jobId = _createAndSubmitJob();

        vm.prank(provider);
        vm.expectRevert(DisputeManager.Unauthorized.selector);
        disputeManager.openDispute(jobId, EVIDENCE_HASH);
    }

    function testAttackerCannotOpen() public {
        uint256 jobId = _createAndSubmitJob();

        vm.prank(attacker);
        vm.expectRevert(DisputeManager.Unauthorized.selector);
        disputeManager.openDispute(jobId, EVIDENCE_HASH);
    }

    function testZeroEvidenceRejected() public {
        uint256 jobId = _createAndSubmitJob();

        vm.prank(vault);
        vm.expectRevert(DisputeManager.InvalidEvidence.selector);
        disputeManager.openDispute(jobId, bytes32(0));
    }

    function testWrongJobRejected() public {
        _createAndSubmitJob();

        vm.prank(vault);
        vm.expectRevert(DisputeManager.Unauthorized.selector);
        disputeManager.openDispute(999, EVIDENCE_HASH);
    }

    function testWrongStatusRejected() public {
        vm.prank(vault);
        uint256 jobId = escrow.createJob(provider, 25 * ONE_USDC, 10 * ONE_USDC, block.timestamp + 2 hours, SERVICE_ID);

        vm.prank(vault);
        vm.expectRevert(DisputeManager.JobNotWorkSubmitted.selector);
        disputeManager.openDispute(jobId, EVIDENCE_HASH);
    }

    function testDuplicateDisputeRejected() public {
        uint256 jobId = _createAndSubmitJob();

        vm.prank(vault);
        disputeManager.openDispute(jobId, EVIDENCE_HASH);

        vm.prank(vault);
        vm.expectRevert(DisputeManager.DisputeAlreadyExists.selector);
        disputeManager.openDispute(jobId, EVIDENCE_HASH);
    }

    // ── Window ──

    function testBeforeWindowAllowed() public {
        uint256 jobId = _createAndSubmitJob();

        vm.warp(block.timestamp + 12 hours);

        vm.prank(vault);
        disputeManager.openDispute(jobId, EVIDENCE_HASH);
    }

    function testAfterWindowRejected() public {
        uint256 jobId = _createAndSubmitJob();

        vm.warp(block.timestamp + 24 hours + 1);

        vm.prank(vault);
        vm.expectRevert(DisputeManager.DisputeWindowExpired.selector);
        disputeManager.openDispute(jobId, EVIDENCE_HASH);
    }

    // ── Arbitration ──

    function testArbitratorProviderWins() public {
        uint256 jobId = _createAndSubmitJob();

        vm.prank(vault);
        disputeManager.openDispute(jobId, EVIDENCE_HASH);

        vm.prank(arbitrator);
        disputeManager.resolveProviderWins(jobId);

        (,,,, IDisputeManager.DisputeStatus status,) = disputeManager.getDispute(jobId);
        assertEq(uint8(status), uint8(IDisputeManager.DisputeStatus.ProviderWins));
    }

    function testArbitratorAgentWins() public {
        uint256 jobId = _createAndSubmitJob();

        vm.prank(vault);
        disputeManager.openDispute(jobId, EVIDENCE_HASH);

        vm.prank(arbitrator);
        disputeManager.resolveAgentWins(jobId);

        (,,,, IDisputeManager.DisputeStatus status,) = disputeManager.getDispute(jobId);
        assertEq(uint8(status), uint8(IDisputeManager.DisputeStatus.AgentWins));
    }

    function testAgentResolveRejected() public {
        uint256 jobId = _createAndSubmitJob();

        vm.prank(vault);
        disputeManager.openDispute(jobId, EVIDENCE_HASH);

        vm.prank(vault);
        vm.expectRevert(DisputeManager.Unauthorized.selector);
        disputeManager.resolveAgentWins(jobId);
    }

    function testProviderResolveRejected() public {
        uint256 jobId = _createAndSubmitJob();

        vm.prank(vault);
        disputeManager.openDispute(jobId, EVIDENCE_HASH);

        vm.prank(provider);
        vm.expectRevert(DisputeManager.Unauthorized.selector);
        disputeManager.resolveProviderWins(jobId);
    }

    function testAttackerResolveRejected() public {
        uint256 jobId = _createAndSubmitJob();

        vm.prank(vault);
        disputeManager.openDispute(jobId, EVIDENCE_HASH);

        vm.prank(attacker);
        vm.expectRevert(DisputeManager.Unauthorized.selector);
        disputeManager.resolveProviderWins(jobId);
    }

    // ── Finality ──

    function testProviderWinsCannotResolveAgain() public {
        uint256 jobId = _createAndSubmitJob();

        vm.prank(vault);
        disputeManager.openDispute(jobId, EVIDENCE_HASH);

        vm.prank(arbitrator);
        disputeManager.resolveProviderWins(jobId);

        vm.prank(arbitrator);
        vm.expectRevert(DisputeManager.DisputeNotOpen.selector);
        disputeManager.resolveAgentWins(jobId);
    }

    function testAgentWinsCannotResolveAgain() public {
        uint256 jobId = _createAndSubmitJob();

        vm.prank(vault);
        disputeManager.openDispute(jobId, EVIDENCE_HASH);

        vm.prank(arbitrator);
        disputeManager.resolveAgentWins(jobId);

        vm.prank(arbitrator);
        vm.expectRevert(DisputeManager.DisputeNotOpen.selector);
        disputeManager.resolveProviderWins(jobId);
    }
}
