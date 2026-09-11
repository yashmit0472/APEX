// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PaymentEscrow} from "../src/PaymentEscrow.sol";
import {DeliveryVerifier} from "../src/DeliveryVerifier.sol";
import {StakeManager} from "../src/StakeManager.sol";
import {ProviderRegistry} from "../src/ProviderRegistry.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {IPaymentEscrow} from "../src/interfaces/IPaymentEscrow.sol";

contract PaymentEscrowTest is Test {
    MockUSDC token;
    ProviderRegistry registry;
    StakeManager stakeManager;
    DeliveryVerifier verifier;
    PaymentEscrow escrow;

    address owner = address(1);
    address vault = address(2);
    address provider = address(3);
    address attacker = address(4);
    address treasury = address(5);

    uint256 constant ONE_USDC = 1_000_000;
    uint256 constant MINIMUM_STAKE = 10_000_000;

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

        // Authorize vault as a job creator
        vm.prank(owner);
        escrow.setCreatorAuthorization(
            vault,
            true
        );

        // Authorize escrow as a locker on StakeManager
        vm.prank(owner);
        stakeManager.setLockerAuthorization(
            address(escrow),
            true
        );

        // Register provider
        vm.prank(provider);
        registry.registerProvider(
            "GPU",
            "https://gpu.example"
        );

        // Provider stakes
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

        // Vault gets tokens (it acts as the agent)
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

    // ── Helpers ──

    function _createDefaultJob()
        internal
        returns (uint256 jobId)
    {
        vm.prank(vault);

        jobId = escrow.createJob(
            provider,
            25 * ONE_USDC,
            10 * ONE_USDC,
            block.timestamp + 2 hours,
            SERVICE_ID
        );
    }

    // ── Authorization ──

    function testUnauthorizedCreatorReverts()
        public
    {
        vm.prank(attacker);
        vm.expectRevert(
            PaymentEscrow.UnauthorizedCreator.selector
        );

        escrow.createJob(
            provider,
            25 * ONE_USDC,
            10 * ONE_USDC,
            block.timestamp + 2 hours,
            SERVICE_ID
        );
    }

    function testSetCreatorAuthorization() public {
        address newCreator = address(99);

        vm.prank(owner);
        escrow.setCreatorAuthorization(
            newCreator,
            true
        );

        assertTrue(
            escrow.authorizedCreators(newCreator)
        );
    }

    function testRevokeCreatorAuthorization()
        public
    {
        vm.prank(owner);
        escrow.setCreatorAuthorization(
            vault,
            false
        );

        vm.prank(vault);
        vm.expectRevert(
            PaymentEscrow.UnauthorizedCreator.selector
        );

        escrow.createJob(
            provider,
            25 * ONE_USDC,
            10 * ONE_USDC,
            block.timestamp + 2 hours,
            SERVICE_ID
        );
    }

    function testOnlyOwnerCanSetCreatorAuth()
        public
    {
        vm.prank(attacker);
        vm.expectRevert();

        escrow.setCreatorAuthorization(
            attacker,
            true
        );
    }

    // ── createJob ──

    function testCreateJob() public {
        uint256 jobId = _createDefaultJob();

        IPaymentEscrow.Job memory job =
            escrow.getJob(jobId);

        assertEq(job.agent, vault);
        assertEq(job.provider, provider);
        assertEq(job.amount, 25 * ONE_USDC);
        assertEq(job.stakeRequired, 10 * ONE_USDC);
        assertEq(job.serviceId, SERVICE_ID);

        assertEq(
            uint8(job.status),
            uint8(IPaymentEscrow.JobStatus.Funded)
        );
    }

    function testCreateJobLocksProviderStake()
        public
    {
        uint256 lockedBefore =
            stakeManager.lockedBalance(provider);

        _createDefaultJob();

        assertEq(
            stakeManager.lockedBalance(provider),
            lockedBefore + 10 * ONE_USDC
        );
    }

    function testCreateJobPullsPayment() public {
        uint256 balBefore =
            token.balanceOf(vault);

        _createDefaultJob();

        assertEq(
            token.balanceOf(vault),
            balBefore - 25 * ONE_USDC
        );
    }

    function testCreateJobRevertsZeroAmount()
        public
    {
        vm.prank(vault);
        vm.expectRevert(
            PaymentEscrow.InvalidAmount.selector
        );

        escrow.createJob(
            provider,
            0,
            10 * ONE_USDC,
            block.timestamp + 2 hours,
            SERVICE_ID
        );
    }

    function testCreateJobRevertsZeroProvider()
        public
    {
        vm.prank(vault);
        vm.expectRevert(
            PaymentEscrow.InvalidProvider.selector
        );

        escrow.createJob(
            address(0),
            25 * ONE_USDC,
            10 * ONE_USDC,
            block.timestamp + 2 hours,
            SERVICE_ID
        );
    }

    function testCreateJobRevertsPastDeadline()
        public
    {
        vm.prank(vault);
        vm.expectRevert(
            PaymentEscrow.InvalidDeadline.selector
        );

        escrow.createJob(
            provider,
            25 * ONE_USDC,
            10 * ONE_USDC,
            block.timestamp,
            SERVICE_ID
        );
    }

    function testCreateJobRevertsInactiveProvider()
        public
    {
        // Deactivate provider
        vm.prank(owner);
        registry.setProviderActive(
            provider,
            false
        );

        vm.prank(vault);
        vm.expectRevert(
            PaymentEscrow.ProviderNotEligible.selector
        );

        escrow.createJob(
            provider,
            25 * ONE_USDC,
            10 * ONE_USDC,
            block.timestamp + 2 hours,
            SERVICE_ID
        );
    }

    function testCreateJobRevertsInsufficientStake()
        public
    {
        // Provider has 100 USDC staked, request
        // more than available
        vm.prank(vault);
        vm.expectRevert(
            PaymentEscrow
                .InsufficientProviderStake
                .selector
        );

        escrow.createJob(
            provider,
            25 * ONE_USDC,
            200 * ONE_USDC,
            block.timestamp + 2 hours,
            SERVICE_ID
        );
    }

    // ── submitDelivery ──

    function testSubmitDelivery() public {
        uint256 jobId = _createDefaultJob();

        vm.prank(provider);
        escrow.submitDelivery(
            jobId,
            DELIVERY_HASH
        );

        IPaymentEscrow.Job memory job =
            escrow.getJob(jobId);

        assertEq(job.deliveryHash, DELIVERY_HASH);

        assertEq(
            uint8(job.status),
            uint8(IPaymentEscrow.JobStatus.WorkSubmitted)
        );
    }

    function testSubmitDeliveryRevertsNotProvider()
        public
    {
        uint256 jobId = _createDefaultJob();

        vm.prank(attacker);
        vm.expectRevert(
            PaymentEscrow.OnlyProvider.selector
        );

        escrow.submitDelivery(
            jobId,
            DELIVERY_HASH
        );
    }

    function testSubmitDeliveryRevertsAfterDeadline()
        public
    {
        uint256 jobId = _createDefaultJob();

        vm.warp(block.timestamp + 3 hours);

        vm.prank(provider);
        vm.expectRevert(
            PaymentEscrow.DeadlineExpired.selector
        );

        escrow.submitDelivery(
            jobId,
            DELIVERY_HASH
        );
    }

    function testSubmitDeliveryRevertsZeroHash()
        public
    {
        uint256 jobId = _createDefaultJob();

        vm.prank(provider);
        vm.expectRevert(
            PaymentEscrow.InvalidDeliveryHash.selector
        );

        escrow.submitDelivery(
            jobId,
            bytes32(0)
        );
    }

    // ── settle ──

    function testSettle() public {
        uint256 jobId = _createDefaultJob();

        vm.prank(provider);
        escrow.submitDelivery(
            jobId,
            DELIVERY_HASH
        );

        uint256 providerBalBefore =
            token.balanceOf(provider);

        escrow.settle(jobId);

        IPaymentEscrow.Job memory job =
            escrow.getJob(jobId);

        assertEq(
            uint8(job.status),
            uint8(IPaymentEscrow.JobStatus.Settled)
        );

        assertEq(
            token.balanceOf(provider),
            providerBalBefore + 25 * ONE_USDC
        );
    }

    function testSettleUnlocksStake() public {
        uint256 jobId = _createDefaultJob();

        uint256 lockedBefore =
            stakeManager.lockedBalance(provider);

        vm.prank(provider);
        escrow.submitDelivery(
            jobId,
            DELIVERY_HASH
        );

        escrow.settle(jobId);

        assertEq(
            stakeManager.lockedBalance(provider),
            lockedBefore - 10 * ONE_USDC
        );
    }

    function testSettleRevertsIfNotWorkSubmitted()
        public
    {
        uint256 jobId = _createDefaultJob();

        vm.expectRevert(
            PaymentEscrow.JobNotWorkSubmitted.selector
        );

        escrow.settle(jobId);
    }

    // ── refund ──

    function testRefundAfterDeadline() public {
        uint256 jobId = _createDefaultJob();

        vm.warp(block.timestamp + 3 hours);

        uint256 vaultBalBefore =
            token.balanceOf(vault);

        escrow.refund(jobId);

        IPaymentEscrow.Job memory job =
            escrow.getJob(jobId);

        assertEq(
            uint8(job.status),
            uint8(IPaymentEscrow.JobStatus.Refunded)
        );

        // Vault gets back 25 USDC payment only.
        // Slashed collateral goes to treasury.
        assertEq(
            token.balanceOf(vault),
            vaultBalBefore + 25 * ONE_USDC
        );
    }

    function testRefundSlashesProviderToTreasury()
        public
    {
        uint256 jobId = _createDefaultJob();

        uint256 treasuryBefore =
            token.balanceOf(treasury);
        uint256 stakedBefore =
            stakeManager.stakedBalance(provider);

        vm.warp(block.timestamp + 3 hours);

        escrow.refund(jobId);

        // Provider stake is slashed
        assertEq(
            stakeManager.stakedBalance(provider),
            stakedBefore - 10 * ONE_USDC
        );

        // Slashed collateral goes to treasury
        assertEq(
            token.balanceOf(treasury),
            treasuryBefore + 10 * ONE_USDC
        );
    }

    function testRefundRevertsBeforeDeadline()
        public
    {
        uint256 jobId = _createDefaultJob();

        vm.expectRevert(
            PaymentEscrow.DeadlineNotExpired.selector
        );

        escrow.refund(jobId);
    }

    function testRefundRevertsIfNotFunded()
        public
    {
        uint256 jobId = _createDefaultJob();

        vm.prank(provider);
        escrow.submitDelivery(
            jobId,
            DELIVERY_HASH
        );

        vm.warp(block.timestamp + 3 hours);

        vm.expectRevert(
            PaymentEscrow.JobNotFunded.selector
        );

        escrow.refund(jobId);
    }

    // ── Multi-job stake exhaustion (Step 29) ──

    function testMultipleJobsExhaustStake() public {
        // Provider has 100 USDC staked.

        // Job A: locks 30 → 70 available
        vm.prank(vault);
        escrow.createJob(
            provider,
            5 * ONE_USDC,
            30 * ONE_USDC,
            block.timestamp + 2 hours,
            SERVICE_ID
        );

        assertEq(
            stakeManager.availableStake(provider),
            70 * ONE_USDC
        );

        // Job B: locks 20 → 50 available
        vm.prank(vault);
        escrow.createJob(
            provider,
            5 * ONE_USDC,
            20 * ONE_USDC,
            block.timestamp + 2 hours,
            SERVICE_ID
        );

        assertEq(
            stakeManager.availableStake(provider),
            50 * ONE_USDC
        );

        // Job C: requests 60 → must fail
        // because 60 > 50 available
        vm.prank(vault);
        vm.expectRevert(
            PaymentEscrow
                .InsufficientProviderStake
                .selector
        );

        escrow.createJob(
            provider,
            5 * ONE_USDC,
            60 * ONE_USDC,
            block.timestamp + 2 hours,
            SERVICE_ID
        );
    }

    // ── State transition attacks ──

    function testDuplicateDeliveryReverts()
        public
    {
        uint256 jobId = _createDefaultJob();

        vm.prank(provider);
        escrow.submitDelivery(
            jobId,
            DELIVERY_HASH
        );

        // Status is now WORK_SUBMITTED,
        // second delivery must fail
        vm.prank(provider);
        vm.expectRevert(
            PaymentEscrow.JobNotFunded.selector
        );

        escrow.submitDelivery(
            jobId,
            keccak256("result_v2")
        );
    }

    function testRefundTwiceReverts() public {
        uint256 jobId = _createDefaultJob();

        vm.warp(block.timestamp + 3 hours);

        escrow.refund(jobId);

        // Second refund must fail
        vm.expectRevert(
            PaymentEscrow.JobNotFunded.selector
        );

        escrow.refund(jobId);
    }

    function testSettleAfterRefundReverts()
        public
    {
        uint256 jobId = _createDefaultJob();

        vm.warp(block.timestamp + 3 hours);

        escrow.refund(jobId);

        // Cannot settle a refunded job
        vm.expectRevert(
            PaymentEscrow.JobNotWorkSubmitted.selector
        );

        escrow.settle(jobId);
    }

    function testRefundAfterSettleReverts()
        public
    {
        uint256 jobId = _createDefaultJob();

        vm.prank(provider);
        escrow.submitDelivery(
            jobId,
            DELIVERY_HASH
        );

        escrow.settle(jobId);

        vm.warp(block.timestamp + 3 hours);

        // Cannot refund a settled job
        vm.expectRevert(
            PaymentEscrow.JobNotFunded.selector
        );

        escrow.refund(jobId);
    }

    function testSettleTwiceReverts() public {
        uint256 jobId = _createDefaultJob();

        vm.prank(provider);
        escrow.submitDelivery(
            jobId,
            DELIVERY_HASH
        );

        escrow.settle(jobId);

        // Second settle must fail
        vm.expectRevert(
            PaymentEscrow.JobNotWorkSubmitted.selector
        );

        escrow.settle(jobId);
    }

    function testSettleWithoutDeliveryReverts()
        public
    {
        uint256 jobId = _createDefaultJob();

        // Job is FUNDED, not WORK_SUBMITTED
        vm.expectRevert(
            PaymentEscrow.JobNotWorkSubmitted.selector
        );

        escrow.settle(jobId);
    }
}
