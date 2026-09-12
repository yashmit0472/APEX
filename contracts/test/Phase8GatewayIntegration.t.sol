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

contract Phase8GatewayIntegrationTest is Test {
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
    address internal otherProvider = address(6);
    address internal attacker = address(5);
    address internal treasury = address(4);

    uint256 internal constant USDC = 1e6;
    uint256 internal constant MINIMUM_STAKE = 50 * USDC;

    bytes32 internal constant SERVICE_ID = keccak256("GPU_COMPUTE");
    bytes32 internal constant OTHER_SERVICE = keccak256("STORAGE");

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
    }

    function testUnauthorizedPaymentRevertsBeforeVault() public {
        IAgentAuthorization.PaymentIntent memory intent =
            _intent(keccak256("unauthorized"), agent, provider, 5 * USDC, SERVICE_ID, block.timestamp + 1 hours, 0);

        uint256 vaultBalanceBefore = usdc.balanceOf(address(vault));

        vm.prank(attacker);

        vm.expectRevert(PaymentRouter.UnauthorizedCaller.selector);

        router.execute(intent);

        assertEq(usdc.balanceOf(address(vault)), vaultBalanceBefore);

        assertEq(vault.totalSpent(), 0);

        assertEq(escrow.nextJobId(), 0);
    }

    function testExpiredAuthorizationRevertsBeforeVault() public {
        vm.warp(block.timestamp + 1 days);

        IAgentAuthorization.PaymentIntent memory intent =
            _intent(keccak256("expired"), agent, provider, 5 * USDC, SERVICE_ID, block.timestamp + 1 hours, 0);

        uint256 vaultBalanceBefore = usdc.balanceOf(address(vault));

        vm.prank(agent);

        vm.expectRevert(AgentAuthorization.AgentAuthorizationExpired.selector);

        router.execute(intent);

        assertEq(usdc.balanceOf(address(vault)), vaultBalanceBefore);

        assertEq(vault.totalSpent(), 0);

        assertEq(escrow.nextJobId(), 0);
    }

    function testProviderNotApprovedRevertsBeforeVault() public {
        IAgentAuthorization.PaymentIntent memory intent = _intent(
            keccak256("bad-provider"), agent, otherProvider, 5 * USDC, SERVICE_ID, block.timestamp + 1 hours, 0
        );

        uint256 vaultBalanceBefore = usdc.balanceOf(address(vault));

        vm.prank(agent);

        vm.expectRevert(AgentAuthorization.ProviderNotAuthorized.selector);

        router.execute(intent);

        assertEq(usdc.balanceOf(address(vault)), vaultBalanceBefore);

        assertEq(vault.totalSpent(), 0);

        assertEq(escrow.nextJobId(), 0);
    }

    function testPerTransactionLimitRevertsBeforeVault() public {
        vm.prank(owner);

        authorization.updateAgentLimits(
            agent, provider, SERVICE_ID, 100 * USDC, 10 * USDC, 50 * USDC, block.timestamp + 1 days
        );

        IAgentAuthorization.PaymentIntent memory intent =
            _intent(keccak256("per-tx-limit"), agent, provider, 11 * USDC, SERVICE_ID, block.timestamp + 1 hours, 0);

        uint256 vaultBalanceBefore = usdc.balanceOf(address(vault));

        vm.prank(agent);

        vm.expectRevert(AgentAuthorization.PerTxCapExceeded.selector);

        router.execute(intent);

        assertEq(usdc.balanceOf(address(vault)), vaultBalanceBefore);

        assertEq(vault.totalSpent(), 0);

        assertEq(escrow.nextJobId(), 0);
    }

    function testDailyAuthorizationLimitRevertsBeforeVault() public {
        IAgentAuthorization.PaymentIntent memory first =
            _intent(keccak256("daily-1"), agent, provider, 20 * USDC, SERVICE_ID, block.timestamp + 1 hours, 0);

        vm.prank(agent);

        authorization.executePayment(first);

        IAgentAuthorization.PaymentIntent memory second =
            _intent(keccak256("daily-2"), agent, provider, 20 * USDC, SERVICE_ID, block.timestamp + 1 hours, 1);

        vm.prank(agent);

        authorization.executePayment(second);

        IAgentAuthorization.PaymentIntent memory third =
            _intent(keccak256("daily-3"), agent, provider, 20 * USDC, SERVICE_ID, block.timestamp + 1 hours, 2);

        uint256 vaultBalanceBefore = usdc.balanceOf(address(vault));

        uint256 totalSpentBefore = vault.totalSpent();

        vm.prank(agent);

        vm.expectRevert(AgentAuthorization.DailyCapExceeded.selector);

        authorization.executePayment(third);

        assertEq(usdc.balanceOf(address(vault)), vaultBalanceBefore);

        assertEq(vault.totalSpent(), totalSpentBefore);

        assertEq(authorization.nonces(agent), 2);

        assertEq(escrow.nextJobId(), 2);

        assertEq(authorization.dailySpent(agent), 40 * USDC);
    }

    function testReusedRequestIdRevertsBeforeSecondVaultPayment() public {
        bytes32 requestId = keccak256("reused-request");

        IAgentAuthorization.PaymentIntent memory first =
            _intent(requestId, agent, provider, 5 * USDC, SERVICE_ID, block.timestamp + 1 hours, 0);

        vm.prank(agent);

        router.execute(first);

        uint256 vaultBalanceAfterFirst = usdc.balanceOf(address(vault));

        uint256 totalSpentAfterFirst = vault.totalSpent();

        uint256 jobsAfterFirst = escrow.nextJobId();

        IAgentAuthorization.PaymentIntent memory replay =
            _intent(requestId, agent, provider, 5 * USDC, SERVICE_ID, block.timestamp + 1 hours, 1);

        vm.prank(agent);

        vm.expectRevert(AgentAuthorization.RequestAlreadyUsed.selector);

        router.execute(replay);

        assertEq(usdc.balanceOf(address(vault)), vaultBalanceAfterFirst);

        assertEq(vault.totalSpent(), totalSpentAfterFirst);

        assertEq(escrow.nextJobId(), jobsAfterFirst);
    }

    function testValidAuthorizedPaymentSucceeds() public {
        bytes32 requestId = keccak256("valid-payment");

        IAgentAuthorization.PaymentIntent memory intent =
            _intent(requestId, agent, provider, 5 * USDC, SERVICE_ID, block.timestamp + 1 hours, 0);

        uint256 vaultBalanceBefore = usdc.balanceOf(address(vault));

        vm.prank(agent);

        (uint256 jobId, uint256 score, IPaymentFirewall.Decision decision) = router.execute(intent);

        assertEq(jobId, 0);

        assertEq(score, 20);

        assertEq(uint256(decision), uint256(IPaymentFirewall.Decision.AUTO_PAY));

        assertEq(usdc.balanceOf(address(vault)), vaultBalanceBefore - 5 * USDC);

        assertEq(vault.totalSpent(), 5 * USDC);
    }

    function testVaultBalanceDecreasesOnlyOnce() public {
        bytes32 requestId = keccak256("single-payment");

        IAgentAuthorization.PaymentIntent memory intent =
            _intent(requestId, agent, provider, 5 * USDC, SERVICE_ID, block.timestamp + 1 hours, 0);

        uint256 vaultBalanceBefore = usdc.balanceOf(address(vault));

        vm.prank(agent);

        router.execute(intent);

        uint256 vaultBalanceAfter = usdc.balanceOf(address(vault));

        assertEq(vaultBalanceAfter, vaultBalanceBefore - 5 * USDC);

        assertEq(vault.totalSpent(), 5 * USDC);

        assertEq(escrow.nextJobId(), 1);

        vm.prank(agent);

        vm.expectRevert(AgentAuthorization.RequestAlreadyUsed.selector);

        router.execute(intent);

        assertEq(usdc.balanceOf(address(vault)), vaultBalanceAfter);

        assertEq(vault.totalSpent(), 5 * USDC);

        assertEq(escrow.nextJobId(), 1);
    }

    function testEscrowJobCreatedOnlyAfterValidAuthorization() public {
        vm.prank(owner);

        authorization.updateAgentLimits(
            agent, provider, SERVICE_ID, 100 * USDC, 10 * USDC, 50 * USDC, block.timestamp + 1 days
        );

        IAgentAuthorization.PaymentIntent memory invalidIntent = _intent(
            keccak256("invalid-before-escrow"), agent, provider, 11 * USDC, SERVICE_ID, block.timestamp + 1 hours, 0
        );

        vm.prank(agent);

        vm.expectRevert(AgentAuthorization.PerTxCapExceeded.selector);

        router.execute(invalidIntent);

        assertEq(escrow.nextJobId(), 0);

        IAgentAuthorization.PaymentIntent memory validIntent = _intent(
            keccak256("valid-before-escrow"), agent, provider, 5 * USDC, SERVICE_ID, block.timestamp + 1 hours, 0
        );

        vm.prank(agent);

        uint256 jobId;
        (jobId,,) = router.execute(validIntent);

        assertEq(jobId, 0);

        assertEq(escrow.nextJobId(), 1);

        IPaymentEscrow.Job memory job = escrow.getJob(jobId);

        assertEq(uint256(job.status), uint256(IPaymentEscrow.JobStatus.Funded));

        assertEq(job.provider, provider);

        assertEq(job.amount, 5 * USDC);
    }

    function _intent(
        bytes32 requestId,
        address intentAgent,
        address intentProvider,
        uint256 amount,
        bytes32 serviceId,
        uint256 deadline,
        uint256 nonce
    ) internal pure returns (IAgentAuthorization.PaymentIntent memory) {
        return IAgentAuthorization.PaymentIntent({
            requestId: requestId,
            agent: intentAgent,
            provider: intentProvider,
            amount: amount,
            serviceId: serviceId,
            deadline: deadline,
            nonce: nonce,
            stakeRequired: 10 * USDC
        });
    }
}
