// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {AgentAuthorization} from "../src/AgentAuthorization.sol";
import {IAgentAuthorization} from "../src/interfaces/IAgentAuthorization.sol";
import {IAgentSpendingVault} from "../src/interfaces/IAgentSpendingVault.sol";

contract MockSpendingVault is IAgentSpendingVault {
    uint256 public nextJobId;

    Policy private _policy;

    function createJob(bytes32, address, uint256, uint256, uint256, bytes32) external returns (uint256 jobId) {
        jobId = nextJobId++;
    }

    function remainingAllowance() external pure returns (uint256) {
        return 1_000_000;
    }

    function remainingDailyAllowance() external pure returns (uint256) {
        return 1_000_000;
    }

    function policy() external view returns (Policy memory) {
        return _policy;
    }
}

contract AgentAuthorizationTest is Test {
    AgentAuthorization authorization;
    MockSpendingVault vault;

    address owner = address(1);
    address agent = address(2);
    address provider = address(3);
    address otherProvider = address(4);

    bytes32 serviceId = keccak256("GPU_COMPUTE");

    bytes32 otherService = keccak256("STORAGE");

    function setUp() public {
        vault = new MockSpendingVault();

        authorization = new AgentAuthorization(owner, address(vault));

        vm.prank(owner);

        authorization.authorizeAgent(agent, provider, serviceId, 1000, 200, 500, block.timestamp + 1 days);
    }

    function _intent(
        bytes32 requestId,
        address intentAgent,
        address intentProvider,
        uint256 amount,
        bytes32 intentService,
        uint256 deadline,
        uint256 nonce
    ) internal view returns (IAgentAuthorization.PaymentIntent memory) {
        return IAgentAuthorization.PaymentIntent({
            requestId: requestId,
            agent: intentAgent,
            provider: intentProvider,
            amount: amount,
            serviceId: intentService,
            deadline: deadline,
            nonce: nonce,
            stakeRequired: 10
        });
    }

    function testAgentAuthorized() public view {
        assertTrue(authorization.isAuthorized(agent));
    }

    function testExecutePayment() public {
        IAgentAuthorization.PaymentIntent memory intent =
            _intent(keccak256("REQ-1"), agent, provider, 100, serviceId, block.timestamp + 1 hours, 0);

        vm.prank(agent);

        uint256 jobId = authorization.executePayment(intent);

        assertEq(jobId, 0);
        assertEq(authorization.totalSpent(agent), 100);
        assertEq(authorization.dailySpent(agent), 100);
        assertEq(authorization.nonces(agent), 1);
    }

    function testCannotExecuteFromWrongAgent() public {
        IAgentAuthorization.PaymentIntent memory intent =
            _intent(keccak256("REQ-1"), agent, provider, 100, serviceId, block.timestamp + 1 hours, 0);

        vm.prank(address(99));

        vm.expectRevert(AgentAuthorization.AgentNotAuthorized.selector);

        authorization.executePayment(intent);
    }

    function testCannotReplayRequest() public {
        bytes32 requestId = keccak256("REQ-1");

        IAgentAuthorization.PaymentIntent memory intent =
            _intent(requestId, agent, provider, 100, serviceId, block.timestamp + 1 hours, 0);

        vm.prank(agent);
        authorization.executePayment(intent);

        vm.prank(agent);

        IAgentAuthorization.PaymentIntent memory replay =
            _intent(requestId, agent, provider, 100, serviceId, block.timestamp + 1 hours, 1);

        vm.expectRevert(AgentAuthorization.RequestAlreadyUsed.selector);

        authorization.executePayment(replay);
    }

    function testCannotReplayNonce() public {
        IAgentAuthorization.PaymentIntent memory intent =
            _intent(keccak256("REQ-1"), agent, provider, 100, serviceId, block.timestamp + 1 hours, 0);

        vm.prank(agent);
        authorization.executePayment(intent);

        IAgentAuthorization.PaymentIntent memory replay =
            _intent(keccak256("REQ-2"), agent, provider, 100, serviceId, block.timestamp + 1 hours, 0);

        vm.prank(agent);

        vm.expectRevert(AgentAuthorization.InvalidNonce.selector);

        authorization.executePayment(replay);
    }

    function testCannotUseUnauthorizedProvider() public {
        IAgentAuthorization.PaymentIntent memory intent =
            _intent(keccak256("REQ-1"), agent, otherProvider, 100, serviceId, block.timestamp + 1 hours, 0);

        vm.prank(agent);

        vm.expectRevert(AgentAuthorization.ProviderNotAuthorized.selector);

        authorization.executePayment(intent);
    }

    function testCannotUseUnauthorizedService() public {
        IAgentAuthorization.PaymentIntent memory intent =
            _intent(keccak256("REQ-1"), agent, provider, 100, otherService, block.timestamp + 1 hours, 0);

        vm.prank(agent);

        vm.expectRevert(AgentAuthorization.ServiceNotAuthorized.selector);

        authorization.executePayment(intent);
    }

    function testPerTransactionLimit() public {
        IAgentAuthorization.PaymentIntent memory intent =
            _intent(keccak256("REQ-1"), agent, provider, 201, serviceId, block.timestamp + 1 hours, 0);

        vm.prank(agent);

        vm.expectRevert(AgentAuthorization.PerTxCapExceeded.selector);

        authorization.executePayment(intent);
    }

    function testDailyLimit() public {
        IAgentAuthorization.PaymentIntent memory first =
            _intent(keccak256("REQ-1"), agent, provider, 200, serviceId, block.timestamp + 1 hours, 0);

        IAgentAuthorization.PaymentIntent memory second =
            _intent(keccak256("REQ-2"), agent, provider, 200, serviceId, block.timestamp + 1 hours, 1);

        IAgentAuthorization.PaymentIntent memory third =
            _intent(keccak256("REQ-3"), agent, provider, 200, serviceId, block.timestamp + 1 hours, 2);

        vm.startPrank(agent);

        authorization.executePayment(first);
        authorization.executePayment(second);

        vm.expectRevert(AgentAuthorization.DailyCapExceeded.selector);

        authorization.executePayment(third);

        vm.stopPrank();
    }

    function testTotalLimit() public {
        vm.prank(owner);
        authorization.updateAgentLimits(agent, provider, serviceId, 800, 200, 800, block.timestamp + 2 days);

        IAgentAuthorization.PaymentIntent memory first =
            _intent(keccak256("REQ-1"), agent, provider, 200, serviceId, block.timestamp + 1 hours, 0);

        IAgentAuthorization.PaymentIntent memory second =
            _intent(keccak256("REQ-2"), agent, provider, 200, serviceId, block.timestamp + 1 hours, 1);

        IAgentAuthorization.PaymentIntent memory third =
            _intent(keccak256("REQ-3"), agent, provider, 200, serviceId, block.timestamp + 1 hours, 2);

        IAgentAuthorization.PaymentIntent memory fourth =
            _intent(keccak256("REQ-4"), agent, provider, 200, serviceId, block.timestamp + 1 hours, 3);

        IAgentAuthorization.PaymentIntent memory fifth =
            _intent(keccak256("REQ-5"), agent, provider, 100, serviceId, block.timestamp + 2 days, 4);

        vm.startPrank(agent);

        authorization.executePayment(first);
        authorization.executePayment(second);
        authorization.executePayment(third);
        authorization.executePayment(fourth);

        vm.warp(block.timestamp + 1 days); // Reset daily cap so we strictly hit TotalCapExceeded

        vm.expectRevert(AgentAuthorization.TotalCapExceeded.selector);

        authorization.executePayment(fifth);

        vm.stopPrank();
    }

    function testCannotUseExpiredAuthorization() public {
        vm.warp(block.timestamp + 1 days);

        IAgentAuthorization.PaymentIntent memory intent =
            _intent(keccak256("REQ-1"), agent, provider, 100, serviceId, block.timestamp + 1 hours, 0);

        vm.prank(agent);

        vm.expectRevert(AgentAuthorization.AgentAuthorizationExpired.selector);

        authorization.executePayment(intent);
    }

    function testRevokeAgent() public {
        vm.prank(owner);

        authorization.revokeAgent(agent);

        assertFalse(authorization.isAuthorized(agent));
    }

    function testCannotExecuteAfterRevoke() public {
        vm.prank(owner);

        authorization.revokeAgent(agent);

        IAgentAuthorization.PaymentIntent memory intent =
            _intent(keccak256("REQ-1"), agent, provider, 100, serviceId, block.timestamp + 1 hours, 0);

        vm.prank(agent);

        vm.expectRevert(AgentAuthorization.AgentNotAuthorized.selector);

        authorization.executePayment(intent);
    }

    function testDailyLimitResets() public {
        vm.prank(owner);
        authorization.updateAgentLimits(agent, provider, serviceId, 1000, 500, 500, block.timestamp + 10 days);

        IAgentAuthorization.PaymentIntent memory first =
            _intent(keccak256("REQ-1"), agent, provider, 500, serviceId, block.timestamp + 1 hours, 0);

        vm.prank(agent);
        authorization.executePayment(first);

        vm.warp(block.timestamp + 1 days);

        IAgentAuthorization.PaymentIntent memory second =
            _intent(keccak256("REQ-2"), agent, provider, 500, serviceId, block.timestamp + 1 hours, 1);

        vm.prank(agent);
        authorization.executePayment(second);

        assertEq(authorization.dailySpent(agent), 500);
    }
}
