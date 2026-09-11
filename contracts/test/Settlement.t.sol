// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PaymentEscrow} from "../src/PaymentEscrow.sol";
import {DeliveryVerifier} from "../src/DeliveryVerifier.sol";
import {StakeManager} from "../src/StakeManager.sol";
import {ProviderRegistry} from "../src/ProviderRegistry.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {IPaymentEscrow} from "../src/interfaces/IPaymentEscrow.sol";

/// @title Settlement Integration Tests
/// @notice End-to-end tests for the full settlement
///         lifecycle: create → deliver → settle/refund.
///         Validates the economic flows across
///         PaymentEscrow, StakeManager, and DeliveryVerifier.
contract SettlementTest is Test {
    MockUSDC token;
    ProviderRegistry registry;
    StakeManager stakeManager;
    DeliveryVerifier verifier;
    PaymentEscrow escrow;

    address owner = address(1);
    address vault = address(2);
    address provider = address(3);
    address treasury = address(5);

    uint256 constant ONE_USDC = 1_000_000;
    uint256 constant MINIMUM_STAKE = 10_000_000;
    uint256 constant JOB_PAYMENT = 25_000_000;
    uint256 constant STAKE_REQUIRED = 10_000_000;

    bytes32 constant SERVICE_ID =
        keccak256("GPU_COMPUTE");

    bytes32 constant DELIVERY_HASH =
        keccak256("result_v1");

    function setUp() public {
        token = new MockUSDC();
        registry = new ProviderRegistry(owner);

        stakeManager = new StakeManager(
            owner,
            address(token),
            address(registry),
            MINIMUM_STAKE
        );

        verifier = new DeliveryVerifier();

        escrow = new PaymentEscrow(
            owner,
            address(token),
            address(registry),
            address(stakeManager),
            address(verifier),
            treasury
        );

        // Wire up
        vm.startPrank(owner);
        escrow.setCreatorAuthorization(
            vault,
            true
        );
        stakeManager.setLockerAuthorization(
            address(escrow),
            true
        );
        vm.stopPrank();

        // Provider setup
        vm.prank(provider);
        registry.registerProvider(
            "GPU",
            "https://gpu.example"
        );

        token.mint(
            provider,
            1_000 * ONE_USDC
        );

        vm.prank(provider);
        token.approve(
            address(stakeManager),
            type(uint256).max
        );

        vm.prank(provider);
        stakeManager.stake(100 * ONE_USDC);

        // Vault setup (authorized creator)
        token.mint(
            vault,
            1_000 * ONE_USDC
        );

        vm.prank(vault);
        token.approve(
            address(escrow),
            type(uint256).max
        );
    }

    // ── Happy Path: Full Settlement ──

    function testFullSettlementLifecycle() public {
        // Snapshot balances
        uint256 vaultBefore =
            token.balanceOf(vault);
        uint256 providerBefore =
            token.balanceOf(provider);
        uint256 lockedBefore =
            stakeManager.lockedBalance(provider);

        // 1. Vault creates a job
        vm.prank(vault);
        uint256 jobId = escrow.createJob(
            provider,
            JOB_PAYMENT,
            STAKE_REQUIRED,
            block.timestamp + 2 hours,
            SERVICE_ID
        );

        // Vault paid, provider stake locked
        assertEq(
            token.balanceOf(vault),
            vaultBefore - JOB_PAYMENT
        );
        assertEq(
            stakeManager.lockedBalance(provider),
            lockedBefore + STAKE_REQUIRED
        );

        // 2. Provider submits delivery
        vm.prank(provider);
        escrow.submitDelivery(
            jobId,
            DELIVERY_HASH
        );

        // 3. Settlement (MVP verifier auto-passes)
        escrow.settle(jobId);

        // Provider received payment
        assertEq(
            token.balanceOf(provider),
            providerBefore + JOB_PAYMENT
        );

        // Provider stake unlocked
        assertEq(
            stakeManager.lockedBalance(provider),
            lockedBefore
        );

        // Job is settled
        IPaymentEscrow.Job memory job =
            escrow.getJob(jobId);
        assertEq(
            uint8(job.status),
            uint8(IPaymentEscrow.JobStatus.Settled)
        );
    }

    // ── Failure Path: Timeout → Refund + Slash ──

    function testTimeoutRefundAndSlash() public {
        uint256 vaultBefore =
            token.balanceOf(vault);
        uint256 stakedBefore =
            stakeManager.stakedBalance(provider);
        uint256 treasuryBefore =
            token.balanceOf(treasury);

        // 1. Vault creates a job
        vm.prank(vault);
        uint256 jobId = escrow.createJob(
            provider,
            JOB_PAYMENT,
            STAKE_REQUIRED,
            block.timestamp + 2 hours,
            SERVICE_ID
        );

        // 2. Deadline expires with no delivery
        vm.warp(block.timestamp + 3 hours);

        // 3. Refund
        escrow.refund(jobId);

        // Job is REFUNDED
        IPaymentEscrow.Job memory job =
            escrow.getJob(jobId);
        assertEq(
            uint8(job.status),
            uint8(IPaymentEscrow.JobStatus.Refunded)
        );

        // Agent gets payment back
        assertEq(
            token.balanceOf(vault),
            vaultBefore
        );

        // Provider stake is SLASHED
        assertEq(
            stakeManager.stakedBalance(provider),
            stakedBefore - STAKE_REQUIRED
        );

        // Treasury receives slashed collateral
        assertEq(
            token.balanceOf(treasury),
            treasuryBefore + STAKE_REQUIRED
        );
    }

    // ── Economic Verification ──
    // Agent: 100 USDC → pays 25 → refund 25 → 100
    // Provider: 100 stake → slashed 10 → 90
    // Treasury: 0 → +10

    function testFullEconomicFlow() public {
        // Give vault exactly 100 USDC
        address freshVault = address(88);

        token.mint(freshVault, 100 * ONE_USDC);

        vm.prank(freshVault);
        token.approve(
            address(escrow),
            type(uint256).max
        );

        vm.prank(owner);
        escrow.setCreatorAuthorization(
            freshVault,
            true
        );

        uint256 treasuryBefore =
            token.balanceOf(treasury);

        // Create job: 25 USDC payment, 10 USDC collateral
        vm.prank(freshVault);
        uint256 jobId = escrow.createJob(
            provider,
            25 * ONE_USDC,
            10 * ONE_USDC,
            block.timestamp + 2 hours,
            SERVICE_ID
        );

        // After creation:
        // Agent: 75, Escrow: 25, Provider: 100 staked (10 locked)
        assertEq(
            token.balanceOf(freshVault),
            75 * ONE_USDC
        );
        assertEq(
            token.balanceOf(address(escrow)),
            25 * ONE_USDC
        );

        // Provider fails → refund
        vm.warp(block.timestamp + 3 hours);
        escrow.refund(jobId);

        // After refund:
        // Agent: 100, Escrow: 0, Provider: 90 staked, Treasury: +10
        assertEq(
            token.balanceOf(freshVault),
            100 * ONE_USDC
        );
        assertEq(
            token.balanceOf(address(escrow)),
            0
        );
        assertEq(
            stakeManager.stakedBalance(provider),
            90 * ONE_USDC
        );
        assertEq(
            token.balanceOf(treasury),
            treasuryBefore + 10 * ONE_USDC
        );
    }

    // ── No Stake Required: Zero Collateral Job ──

    function testZeroCollateralSettlement() public {
        vm.prank(vault);
        uint256 jobId = escrow.createJob(
            provider,
            JOB_PAYMENT,
            0, // No collateral
            block.timestamp + 2 hours,
            SERVICE_ID
        );

        vm.prank(provider);
        escrow.submitDelivery(
            jobId,
            DELIVERY_HASH
        );

        escrow.settle(jobId);

        IPaymentEscrow.Job memory job =
            escrow.getJob(jobId);
        assertEq(
            uint8(job.status),
            uint8(IPaymentEscrow.JobStatus.Settled)
        );
    }

    // ── Cannot Settle Twice ──

    function testCannotSettleTwice() public {
        vm.prank(vault);
        uint256 jobId = escrow.createJob(
            provider,
            JOB_PAYMENT,
            STAKE_REQUIRED,
            block.timestamp + 2 hours,
            SERVICE_ID
        );

        vm.prank(provider);
        escrow.submitDelivery(
            jobId,
            DELIVERY_HASH
        );

        escrow.settle(jobId);

        vm.expectRevert(
            PaymentEscrow.JobNotWorkSubmitted.selector
        );
        escrow.settle(jobId);
    }

    // ── Cannot Refund After Settlement ──

    function testCannotRefundAfterSettle() public {
        vm.prank(vault);
        uint256 jobId = escrow.createJob(
            provider,
            JOB_PAYMENT,
            STAKE_REQUIRED,
            block.timestamp + 2 hours,
            SERVICE_ID
        );

        vm.prank(provider);
        escrow.submitDelivery(
            jobId,
            DELIVERY_HASH
        );

        escrow.settle(jobId);

        vm.warp(block.timestamp + 3 hours);

        vm.expectRevert(
            PaymentEscrow.JobNotFunded.selector
        );
        escrow.refund(jobId);
    }

    // ── Unauthorized Creator Cannot Bypass ──

    function testUnauthorizedCannotCreateJob()
        public
    {
        address rando = address(42);

        token.mint(rando, 100 * ONE_USDC);

        vm.prank(rando);
        token.approve(
            address(escrow),
            type(uint256).max
        );

        vm.prank(rando);
        vm.expectRevert(
            PaymentEscrow.UnauthorizedCreator.selector
        );

        escrow.createJob(
            provider,
            JOB_PAYMENT,
            STAKE_REQUIRED,
            block.timestamp + 2 hours,
            SERVICE_ID
        );
    }
}
