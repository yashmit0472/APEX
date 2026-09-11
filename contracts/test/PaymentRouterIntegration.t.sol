// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {ProviderRegistry} from "../src/ProviderRegistry.sol";
import {StakeManager} from "../src/StakeManager.sol";
import {DeliveryVerifier} from "../src/DeliveryVerifier.sol";
import {PaymentEscrow} from "../src/PaymentEscrow.sol";
import {AgentSpendingVault} from "../src/AgentSpendingVault.sol";
import {AgentAuthorization} from "../src/AgentAuthorization.sol";
import {PaymentFirewall} from "../src/PaymentFirewall.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";
import {IAgentAuthorization} from "../src/interfaces/IAgentAuthorization.sol";
import {IPaymentEscrow} from "../src/interfaces/IPaymentEscrow.sol";
import {IPaymentFirewall} from "../src/interfaces/IPaymentFirewall.sol";

contract PaymentRouterIntegrationTest is Test {
    MockUSDC internal usdc;
    ProviderRegistry internal registry;
    StakeManager internal stakeManager;
    DeliveryVerifier internal verifier;
    PaymentEscrow internal escrow;
    AgentSpendingVault internal vault;
    AgentAuthorization internal authorization;
    PaymentFirewall internal firewall;
    PaymentRouter internal router;

    address internal owner = address(1);
    address internal agent = address(2);
    address internal provider = address(3);
    address internal attacker = address(5);
    address internal treasury = address(4);

    uint256 internal constant USDC = 1e6;
    uint256 internal constant MINIMUM_STAKE = 50 * USDC;
    bytes32 internal constant SERVICE_ID = keccak256("GPU_COMPUTE");

    function setUp() public {
        usdc = new MockUSDC();
        registry = new ProviderRegistry(owner);
        stakeManager = new StakeManager(owner, address(usdc), address(registry), MINIMUM_STAKE);
        verifier = new DeliveryVerifier();
        escrow = new PaymentEscrow(
            owner, address(usdc), address(registry), address(stakeManager), address(verifier), treasury
        );
        vault = new AgentSpendingVault(owner, address(usdc), owner);
        authorization = new AgentAuthorization(owner, address(vault));
        firewall = new PaymentFirewall(owner, address(vault), address(stakeManager));
        router = new PaymentRouter(address(authorization), address(firewall));

        vm.startPrank(owner);
        vault.setAgent(address(authorization));
        vault.setPolicy(100 * USDC, 25 * USDC, 50 * USDC);
        vault.setStakeManager(address(stakeManager));
        vault.setPaymentEscrow(address(escrow));
        escrow.setCreatorAuthorization(address(vault), true);
        stakeManager.setLockerAuthorization(address(escrow), true);
        authorization.setRouterAuthorization(address(router), true);
        firewall.setEvaluatorAuthorization(address(router), true);
        firewall.setRecorderAuthorization(address(router), true);
        firewall.setPolicy(40, 70, 90, 100, 0, 0, 0, 1 days, 10);
        authorization.authorizeAgent(
            agent, provider, SERVICE_ID, 100 * USDC, 25 * USDC, 50 * USDC, block.timestamp + 1 days
        );

        usdc.mint(owner, 1_000 * USDC);
        usdc.approve(address(vault), 100 * USDC);
        vault.deposit(100 * USDC);
        vm.stopPrank();

        vm.prank(provider);
        registry.registerProvider("GPU_COMPUTE", "https://provider.example");

        usdc.mint(provider, 100 * USDC);
        vm.startPrank(provider);
        usdc.approve(address(stakeManager), MINIMUM_STAKE);
        stakeManager.stake(MINIMUM_STAKE);
        vm.stopPrank();

        vm.prank(agent);
        assertTrue(authorization.isAuthorized(agent));
    }

    function testLowRiskRequestSettlesThroughRouter() public {
        bytes32 requestId = keccak256("low-risk");
        IAgentAuthorization.PaymentIntent memory intent = _intent(requestId, 5 * USDC, 0);

        vm.prank(agent);
        (uint256 jobId, uint256 score, IPaymentFirewall.Decision decision) = router.execute(intent);

        assertEq(jobId, 0);
        assertEq(score, 20);
        assertEq(uint256(decision), uint256(IPaymentFirewall.Decision.AUTO_PAY));
        assertEq(usdc.balanceOf(address(vault)), 95 * USDC);
        assertEq(usdc.balanceOf(address(escrow)), 5 * USDC);

        vm.prank(provider);
        escrow.submitDelivery(jobId, keccak256("delivery-0"));
        escrow.settle(jobId);

        IPaymentEscrow.Job memory job = escrow.getJob(jobId);
        assertEq(uint256(job.status), uint256(IPaymentEscrow.JobStatus.Settled));
        assertEq(usdc.balanceOf(provider), 55 * USDC);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function testHighRiskRequestWaitsForApprovalBeforeMovingFunds() public {
        bytes32 requestId = keccak256("high-risk");
        IAgentAuthorization.PaymentIntent memory intent = _intent(requestId, 20 * USDC, 0);
        uint256 vaultBalanceBefore = usdc.balanceOf(address(vault));
        uint256 escrowBalanceBefore = usdc.balanceOf(address(escrow));

        vm.prank(agent);
        (uint256 jobId, uint256 score, IPaymentFirewall.Decision decision) = router.execute(intent);

        assertEq(jobId, 0);
        assertEq(score, 80);
        assertEq(uint256(decision), uint256(IPaymentFirewall.Decision.REQUIRE_APPROVAL));
        assertEq(usdc.balanceOf(address(vault)), vaultBalanceBefore);
        assertEq(usdc.balanceOf(address(escrow)), escrowBalanceBefore);
        assertEq(vault.totalSpent(), 0);
        assertEq(escrow.nextJobId(), 0);
        assertEq(uint256(firewall.getPendingRequest(requestId).status), uint256(IPaymentFirewall.PendingStatus.Pending));
        assertEq(router.getPendingIntent(requestId).amount, 20 * USDC);

        vm.prank(owner);
        firewall.approveRequest(requestId);

        vm.prank(agent);
        jobId = router.executeApproved(requestId);

        assertEq(jobId, 0);
        assertEq(usdc.balanceOf(address(vault)), vaultBalanceBefore - 20 * USDC);
        assertEq(usdc.balanceOf(address(escrow)), escrowBalanceBefore + 20 * USDC);
        assertEq(vault.totalSpent(), 20 * USDC);
        assertEq(escrow.nextJobId(), 1);
        assertEq(uint256(escrow.getJob(jobId).status), uint256(IPaymentEscrow.JobStatus.Funded));
    }

    function testBlockedRequestDoesNotMoveFundsOrCreateJob() public {
        bytes32 requestId = keccak256("blocked");
        IAgentAuthorization.PaymentIntent memory intent = _intent(requestId, 24 * USDC, 0);
        uint256 vaultBalanceBefore = usdc.balanceOf(address(vault));
        uint256 escrowBalanceBefore = usdc.balanceOf(address(escrow));
        uint256 totalSpentBefore = vault.totalSpent();
        uint256 nextJobIdBefore = escrow.nextJobId();

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PaymentFirewall.RequestBlocked.selector, 96));
        router.execute(intent);

        assertEq(usdc.balanceOf(address(vault)), vaultBalanceBefore);
        assertEq(usdc.balanceOf(address(escrow)), escrowBalanceBefore);
        assertEq(vault.totalSpent(), totalSpentBefore);
        assertEq(escrow.nextJobId(), nextJobIdBefore);
        assertEq(uint256(firewall.getPendingRequest(requestId).status), uint256(IPaymentFirewall.PendingStatus.None));
    }

    function testCallerCannotSubmitIntentForAnotherAgent() public {
        bytes32 requestId = keccak256("forged-agent");
        IAgentAuthorization.PaymentIntent memory intent = _intent(requestId, 5 * USDC, 0);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.UnauthorizedAgent.selector, attacker, agent));
        router.execute(intent);

        assertEq(vault.totalSpent(), 0);
        assertEq(escrow.nextJobId(), 0);
        assertEq(uint256(firewall.getPendingRequest(requestId).status), uint256(IPaymentFirewall.PendingStatus.None));
    }

    function _intent(bytes32 requestId, uint256 amount, uint256 nonce)
        internal
        view
        returns (IAgentAuthorization.PaymentIntent memory)
    {
        return IAgentAuthorization.PaymentIntent({
            requestId: requestId,
            agent: agent,
            provider: provider,
            amount: amount,
            serviceId: SERVICE_ID,
            deadline: block.timestamp + 2 hours,
            nonce: nonce,
            stakeRequired: 10 * USDC
        });
    }
}
