// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {PaymentFirewall} from "../src/PaymentFirewall.sol";
import {IPaymentFirewall} from "../src/interfaces/IPaymentFirewall.sol";

contract FirewallVaultMock {
    uint256 public remainingTotal;
    uint256 public remainingDaily;
    uint256 public perTxCap;

    function setCaps(uint256 total, uint256 daily, uint256 perTx) external {
        remainingTotal = total;
        remainingDaily = daily;
        perTxCap = perTx;
    }

    function remainingAllowance() external view returns (uint256) {
        return remainingTotal;
    }

    function remainingDailyAllowance() external view returns (uint256) {
        return remainingDaily;
    }

    function policy() external view returns (uint256 maxSpend, uint256 perTxCap_, uint256 dailyCap) {
        return (remainingTotal, perTxCap, remainingDaily);
    }
}

contract FirewallStakeManagerMock {
    uint256 public available;

    function setAvailableStake(uint256 amount) external {
        available = amount;
    }

    function availableStake(address) external view returns (uint256) {
        return available;
    }
}

contract PaymentFirewallTest is Test {
    PaymentFirewall firewall;
    FirewallVaultMock vault;
    FirewallStakeManagerMock stakeManager;

    address owner = address(1);
    address attacker = address(2);
    address agent = address(3);
    address provider = address(4);

    function setUp() public {
        vault = new FirewallVaultMock();
        stakeManager = new FirewallStakeManagerMock();
        firewall = new PaymentFirewall(owner, address(vault), address(stakeManager));

        vault.setCaps(100, 100, 100);
        stakeManager.setAvailableStake(type(uint256).max);

        vm.startPrank(owner);
        firewall.setPolicy(40, 70, 90, 100, 0, 0, 0, 1 days, 10);
        firewall.setEvaluatorAuthorization(address(this), true);
        vm.stopPrank();
    }

    function testLowRiskRequestAutoPaysWithoutPendingState() public {
        bytes32 requestId = keccak256("low-risk");

        (uint256 score, IPaymentFirewall.Decision decision) = firewall.evaluate(agent, provider, 10, requestId);

        assertEq(score, 10);
        assertEq(uint256(decision), uint256(IPaymentFirewall.Decision.AUTO_PAY));
        assertEq(uint256(firewall.getPendingRequest(requestId).status), uint256(IPaymentFirewall.PendingStatus.None));
    }

    function testMediumRiskRequestFlagsAndStillProceeds() public {
        bytes32 requestId = keccak256("medium-risk");

        vm.expectEmit(true, false, false, true, address(firewall));
        emit PaymentFirewall.RiskFlagged(requestId, 50);

        (uint256 score, IPaymentFirewall.Decision decision) = firewall.evaluate(agent, provider, 50, requestId);

        assertEq(score, 50);
        assertEq(uint256(decision), uint256(IPaymentFirewall.Decision.FLAG));
        assertFalse(firewall.isRequestApproved(requestId));
        assertEq(uint256(firewall.getPendingRequest(requestId).status), uint256(IPaymentFirewall.PendingStatus.None));
    }

    function testHighRiskRequestRequiresApprovalAndStoresPendingData() public {
        bytes32 requestId = keccak256("high-risk");

        (uint256 score, IPaymentFirewall.Decision decision) = firewall.evaluate(agent, provider, 75, requestId);
        IPaymentFirewall.PendingRequest memory request = firewall.getPendingRequest(requestId);

        assertEq(score, 75);
        assertEq(uint256(decision), uint256(IPaymentFirewall.Decision.REQUIRE_APPROVAL));
        assertEq(request.requestId, requestId);
        assertEq(request.agent, agent);
        assertEq(request.provider, provider);
        assertEq(request.amount, 75);
        assertEq(request.score, 75);
        assertEq(request.timestamp, block.timestamp);
        assertEq(uint256(request.status), uint256(IPaymentFirewall.PendingStatus.Pending));
    }

    function testVeryHighRiskRequestBlocks() public {
        vm.expectRevert(abi.encodeWithSelector(PaymentFirewall.RequestBlocked.selector, 95));

        firewall.evaluate(agent, provider, 95, keccak256("blocked"));
    }

    function testOwnerCanApprovePendingRequest() public {
        bytes32 requestId = keccak256("approve");
        firewall.evaluate(agent, provider, 75, requestId);

        vm.prank(owner);
        firewall.approveRequest(requestId);

        assertTrue(firewall.isRequestApproved(requestId));
        assertEq(
            uint256(firewall.getPendingRequest(requestId).status), uint256(IPaymentFirewall.PendingStatus.Approved)
        );
    }

    function testOwnerCanRejectPendingRequest() public {
        bytes32 requestId = keccak256("reject");
        firewall.evaluate(agent, provider, 75, requestId);

        vm.prank(owner);
        firewall.rejectRequest(requestId);

        assertFalse(firewall.isRequestApproved(requestId));
        assertEq(
            uint256(firewall.getPendingRequest(requestId).status), uint256(IPaymentFirewall.PendingStatus.Rejected)
        );
    }

    function testNonOwnerCannotApproveOrReject() public {
        bytes32 approveRequestId = keccak256("unauthorized-approve");
        bytes32 rejectRequestId = keccak256("unauthorized-reject");
        firewall.evaluate(agent, provider, 75, approveRequestId);
        firewall.evaluate(agent, provider, 75, rejectRequestId);

        vm.startPrank(attacker);
        vm.expectRevert();
        firewall.approveRequest(approveRequestId);

        vm.expectRevert();
        firewall.rejectRequest(rejectRequestId);
        vm.stopPrank();
    }

    function testApprovingNonPendingOrAlreadyDecidedRequestReverts() public {
        bytes32 noneRequestId = keccak256("none");

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PaymentFirewall.NotPending.selector, noneRequestId));
        firewall.approveRequest(noneRequestId);

        bytes32 approvedRequestId = keccak256("already-approved");
        firewall.evaluate(agent, provider, 75, approvedRequestId);

        vm.startPrank(owner);
        firewall.approveRequest(approvedRequestId);
        vm.expectRevert(abi.encodeWithSelector(PaymentFirewall.NotPending.selector, approvedRequestId));
        firewall.approveRequest(approvedRequestId);
        vm.stopPrank();

        bytes32 rejectedRequestId = keccak256("already-rejected");
        firewall.evaluate(agent, provider, 75, rejectedRequestId);

        vm.startPrank(owner);
        firewall.rejectRequest(rejectedRequestId);
        vm.expectRevert(abi.encodeWithSelector(PaymentFirewall.NotPending.selector, rejectedRequestId));
        firewall.rejectRequest(rejectedRequestId);
        vm.stopPrank();
    }

    function testDuplicatePendingRequestIdReverts() public {
        bytes32 requestId = keccak256("duplicate");
        firewall.evaluate(agent, provider, 75, requestId);

        vm.expectRevert(abi.encodeWithSelector(PaymentFirewall.RequestAlreadyPending.selector, requestId));
        firewall.evaluate(agent, provider, 75, requestId);
    }

    function testOwnerCanUpdateScoringPolicy() public {
        vm.prank(owner);
        firewall.setPolicy(30, 60, 85, 10, 20, 30, 40, 2 days, 25);

        assertEq(firewall.flagThreshold(), 30);
        assertEq(firewall.approvalThreshold(), 60);
        assertEq(firewall.blockThreshold(), 85);
        assertEq(firewall.amountWeight(), 10);
        assertEq(firewall.stakeWeight(), 20);
        assertEq(firewall.frequencyWeight(), 30);
        assertEq(firewall.firstPaymentWeight(), 40);
        assertEq(firewall.frequencyWindow(), 2 days);
        assertEq(firewall.frequencyLimit(), 25);
    }

    function testNonOwnerCannotUpdateScoringPolicy() public {
        vm.prank(attacker);
        vm.expectRevert();
        firewall.setPolicy(30, 60, 85, 10, 20, 30, 40, 2 days, 25);
    }

    function testUnauthorizedCallerCannotEvaluate() public {
        vm.prank(attacker);
        vm.expectRevert(PaymentFirewall.UnauthorizedEvaluator.selector);
        firewall.evaluate(agent, provider, 10, keccak256("unauthorized"));
    }

    function testFrequencyRiskStopsCountingAtConfiguredLimit() public {
        vm.prank(owner);
        firewall.setPolicy(40, 70, 90, 0, 0, 100, 0, 1 days, 2);

        firewall.evaluate(agent, provider, 1, keccak256("frequency-1"));
        firewall.evaluate(agent, provider, 1, keccak256("frequency-2"));

        vm.expectRevert(abi.encodeWithSelector(PaymentFirewall.RequestBlocked.selector, 100));
        firewall.evaluate(agent, provider, 1, keccak256("frequency-3"));
    }

    function testFuzzAmountRiskIsBoundedAndMonotonic(uint256 cap, uint256 lowerAmountSeed, uint256 upperAmountSeed)
        public
    {
        cap = bound(cap, 100, type(uint128).max);
        uint256 maxNonBlockingAmount = cap * 89 / 100;
        uint256 lowerAmount = bound(lowerAmountSeed, 1, maxNonBlockingAmount);
        uint256 upperAmount = bound(upperAmountSeed, lowerAmount, maxNonBlockingAmount);

        vault.setCaps(cap, cap, cap);

        (uint256 lowerScore,) = firewall.evaluate(agent, provider, lowerAmount, keccak256("fuzz-lower"));
        (uint256 upperScore,) = firewall.evaluate(agent, provider, upperAmount, keccak256("fuzz-upper"));

        assertLe(lowerScore, 100);
        assertLe(upperScore, 100);
        assertLe(lowerScore, upperScore);
    }
}
