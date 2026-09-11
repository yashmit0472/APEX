// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PaymentEscrow} from "../src/PaymentEscrow.sol";
import {DeliveryVerifier} from "../src/DeliveryVerifier.sol";
import {StakeManager} from "../src/StakeManager.sol";
import {ProviderRegistry} from "../src/ProviderRegistry.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {IPaymentEscrow} from "../src/interfaces/IPaymentEscrow.sol";
import {DisputeManager} from "../src/DisputeManager.sol";

/// @title PaymentEscrow Fuzz & Invariant Tests
/// @notice Validates core invariants with randomized
///         inputs to ensure the state machine is sound.
contract PaymentEscrowFuzzTest is Test {
    MockUSDC token;
    ProviderRegistry registry;
    StakeManager stakeManager;
    DeliveryVerifier verifier;
    PaymentEscrow escrow;
    DisputeManager disputeManager;

    address owner = address(1);
    address vault = address(2);
    address provider = address(3);
    address treasury = address(5);
    address arbitrator = address(6);

    uint256 constant ONE_USDC = 1_000_000;
    uint256 constant MINIMUM_STAKE = 10_000_000;

    bytes32 constant SERVICE_ID = keccak256("GPU_COMPUTE");

    function setUp() public {
        token = new MockUSDC();
        registry = new ProviderRegistry(owner);

        stakeManager = new StakeManager(owner, address(token), address(registry), MINIMUM_STAKE);

        verifier = new DeliveryVerifier();

        escrow = new PaymentEscrow(
            owner, address(token), address(registry), address(stakeManager), address(verifier), treasury
        );
        disputeManager = new DisputeManager(owner, arbitrator, 24 hours);

        vm.startPrank(owner);
        escrow.setCreatorAuthorization(vault, true);
        escrow.setDisputeManager(address(disputeManager));
        stakeManager.setLockerAuthorization(address(escrow), true);
        disputeManager.setPaymentEscrow(address(escrow));
        vm.stopPrank();

        vm.prank(provider);
        registry.registerProvider("GPU", "https://gpu.example");

        token.mint(provider, 100_000 * ONE_USDC);

        vm.prank(provider);
        token.approve(address(stakeManager), type(uint256).max);

        vm.prank(provider);
        stakeManager.stake(10_000 * ONE_USDC);

        token.mint(vault, 100_000 * ONE_USDC);

        vm.prank(vault);
        token.approve(address(escrow), type(uint256).max);
    }

    // ── Invariant 1: No double settlement ──

    function testFuzzSettledJobCannotBeSettled(bytes32 hash) public {
        vm.assume(hash != bytes32(0));

        vm.prank(vault);
        uint256 jobId = escrow.createJob(provider, 25 * ONE_USDC, 10 * ONE_USDC, block.timestamp + 2 hours, SERVICE_ID);

        vm.prank(provider);
        escrow.submitDelivery(jobId, hash);

        escrow.settle(jobId);

        vm.expectRevert(PaymentEscrow.JobNotWorkSubmitted.selector);
        escrow.settle(jobId);
    }

    // ── Invariant 2: No double refund ──

    function testFuzzRefundedJobCannotBeRefunded(uint256 extraTime) public {
        extraTime = bound(extraTime, 1, 365 days);

        vm.prank(vault);
        uint256 jobId = escrow.createJob(provider, 25 * ONE_USDC, 10 * ONE_USDC, block.timestamp + 2 hours, SERVICE_ID);

        vm.warp(block.timestamp + 2 hours + 1);

        escrow.refund(jobId);

        vm.warp(block.timestamp + extraTime);

        vm.expectRevert(PaymentEscrow.JobNotFunded.selector);
        escrow.refund(jobId);
    }

    // ── Invariant 3: No settlement after refund ──

    function testFuzzRefundedJobCannotBeSettled() public {
        vm.prank(vault);
        uint256 jobId = escrow.createJob(provider, 25 * ONE_USDC, 10 * ONE_USDC, block.timestamp + 2 hours, SERVICE_ID);

        vm.warp(block.timestamp + 3 hours);

        escrow.refund(jobId);

        vm.expectRevert(PaymentEscrow.JobNotWorkSubmitted.selector);
        escrow.settle(jobId);
    }

    // ── Invariant 4: Delivery only once ──

    function testFuzzDeliveryOnlyOnce(bytes32 hash1, bytes32 hash2) public {
        vm.assume(hash1 != bytes32(0));
        vm.assume(hash2 != bytes32(0));

        vm.prank(vault);
        uint256 jobId = escrow.createJob(provider, 25 * ONE_USDC, 10 * ONE_USDC, block.timestamp + 2 hours, SERVICE_ID);

        vm.prank(provider);
        escrow.submitDelivery(jobId, hash1);

        vm.prank(provider);
        vm.expectRevert(PaymentEscrow.JobNotFunded.selector);
        escrow.submitDelivery(jobId, hash2);
    }

    // ── Invariant 5: Only assigned provider ──

    function testFuzzOnlyAssignedProviderDelivers(address caller) public {
        vm.assume(caller != provider);
        vm.assume(caller != address(0));

        vm.prank(vault);
        uint256 jobId = escrow.createJob(provider, 25 * ONE_USDC, 10 * ONE_USDC, block.timestamp + 2 hours, SERVICE_ID);

        vm.prank(caller);
        vm.expectRevert(PaymentEscrow.OnlyProvider.selector);
        escrow.submitDelivery(jobId, keccak256("result"));
    }

    // ── Invariant 6: Locked <= Total stake ──

    function testFuzzLockedNeverExceedsTotal(uint8 jobCount, uint256 seed) public {
        jobCount = uint8(bound(jobCount, 1, 10));

        for (uint8 i = 0; i < jobCount; i++) {
            uint256 stakeReq = bound(uint256(keccak256(abi.encodePacked(seed, i))), 1 * ONE_USDC, 50 * ONE_USDC);

            uint256 available = stakeManager.availableStake(provider);

            if (stakeReq > available) {
                break;
            }

            vm.prank(vault);
            escrow.createJob(provider, 1 * ONE_USDC, stakeReq, block.timestamp + 2 hours, SERVICE_ID);

            // Invariant: locked <= total
            assertLe(stakeManager.lockedBalance(provider), stakeManager.stakedBalance(provider));
        }
    }

    // ── Invariant 7: Escrow balance >= outstanding ──

    function testFuzzEscrowSolvency(uint8 jobCount) public {
        jobCount = uint8(bound(jobCount, 1, 5));

        uint256 totalOutstanding;

        for (uint8 i = 0; i < jobCount; i++) {
            uint256 amount = (i + 1) * 5 * ONE_USDC;

            vm.prank(vault);
            escrow.createJob(provider, amount, 1 * ONE_USDC, block.timestamp + 2 hours, SERVICE_ID);

            totalOutstanding += amount;
        }

        // Escrow must hold at least as much
        // as the total outstanding funded amount
        assertGe(token.balanceOf(address(escrow)), totalOutstanding);
    }

    // ── Invariant 8: Collateral locked until terminal ──

    function testFuzzStakeLockedUntilTerminal() public {
        vm.prank(vault);
        uint256 jobId = escrow.createJob(provider, 25 * ONE_USDC, 10 * ONE_USDC, block.timestamp + 2 hours, SERVICE_ID);

        uint256 lockedAfterCreate = stakeManager.lockedBalance(provider);

        // Delivery doesn't change locked balance
        vm.prank(provider);
        escrow.submitDelivery(jobId, keccak256("result"));

        assertEq(stakeManager.lockedBalance(provider), lockedAfterCreate);

        // Only settlement unlocks
        escrow.settle(jobId);

        assertEq(stakeManager.lockedBalance(provider), lockedAfterCreate - 10 * ONE_USDC);
    }

    // ── Fuzz: random amounts settle correctly ──

    function testFuzzSettleRandomAmounts(uint256 payment, uint256 stake) public {
        payment = bound(payment, 1 * ONE_USDC, 100 * ONE_USDC);
        stake = bound(stake, 0, 100 * ONE_USDC);

        uint256 available = stakeManager.availableStake(provider);

        if (stake > available) {
            stake = available;
        }

        uint256 providerBefore = token.balanceOf(provider);

        vm.prank(vault);
        uint256 jobId = escrow.createJob(provider, payment, stake, block.timestamp + 2 hours, SERVICE_ID);

        vm.prank(provider);
        escrow.submitDelivery(jobId, keccak256("result"));

        escrow.settle(jobId);

        // Provider got exactly the payment amount
        assertEq(token.balanceOf(provider), providerBefore + payment);

        IPaymentEscrow.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.status), uint8(IPaymentEscrow.JobStatus.Settled));
    }

    // ── Fuzz: random amounts refund correctly ──

    function testFuzzRefundRandomAmounts(uint256 payment, uint256 stake) public {
        payment = bound(payment, 1 * ONE_USDC, 100 * ONE_USDC);
        stake = bound(stake, 0, 100 * ONE_USDC);

        uint256 available = stakeManager.availableStake(provider);

        if (stake > available) {
            stake = available;
        }

        uint256 vaultBefore = token.balanceOf(vault);
        uint256 treasuryBefore = token.balanceOf(treasury);

        vm.prank(vault);
        uint256 jobId = escrow.createJob(provider, payment, stake, block.timestamp + 2 hours, SERVICE_ID);

        vm.warp(block.timestamp + 3 hours);

        escrow.refund(jobId);

        // Vault gets payment back
        assertEq(token.balanceOf(vault), vaultBefore);

        // Treasury gets slashed stake
        assertEq(token.balanceOf(treasury), treasuryBefore + stake);

        IPaymentEscrow.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.status), uint8(IPaymentEscrow.JobStatus.Refunded));

        assertEq(stakeManager.lockedBalance(provider), 0);

        uint256 expectedStake = 10_000 * ONE_USDC - stake;

        assertEq(stakeManager.stakedBalance(provider), expectedStake);

        assertEq(stakeManager.availableStake(provider), expectedStake);
    }

    // ── Fuzz Invariant for Stake Accounting ──

    function testFuzzStakeAccountingInvariant() public {
        uint256 staked = stakeManager.stakedBalance(provider);

        uint256 locked = stakeManager.lockedBalance(provider);

        uint256 available = stakeManager.availableStake(provider);

        assertLe(locked, staked);

        assertEq(available, staked - locked);
    }
}
