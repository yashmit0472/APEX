// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {AgentSpendingVault} from "../src/AgentSpendingVault.sol";
import {ProviderRegistry} from "../src/ProviderRegistry.sol";
import {StakeManager} from "../src/StakeManager.sol";

contract AgentSpendingVaultTest is Test {
    MockUSDC internal usdc;
    ProviderRegistry internal registry;
    StakeManager internal stakeManager;
    AgentSpendingVault internal vault;

    address internal owner = address(0xA11CE);
    address internal agent = address(0xB0B);
    address internal provider = address(0xCAFE);
    address internal attacker = address(0xBAD);

    uint256 internal constant USDC = 1e6;
    uint256 internal constant MINIMUM_STAKE = 50 * USDC;

    function setUp() public {
        // -------------------------------------------------
        // 1. Deploy token
        // -------------------------------------------------
        usdc = new MockUSDC();

        // -------------------------------------------------
        // 2. Deploy ProviderRegistry
        // -------------------------------------------------
        registry = new ProviderRegistry(owner);

        // -------------------------------------------------
        // 3. Deploy StakeManager
        // -------------------------------------------------
        stakeManager = new StakeManager(
            owner,
            address(usdc),
            address(registry),
            MINIMUM_STAKE
        );

        // -------------------------------------------------
        // 4. Deploy AgentSpendingVault
        // -------------------------------------------------
        vault = new AgentSpendingVault(
            owner,
            address(usdc),
            agent
        );

        // -------------------------------------------------
        // 5. Configure vault policy
        // -------------------------------------------------
        vm.startPrank(owner);
        vault.setPolicy(
            100 * USDC,
            25 * USDC,
            50 * USDC
        );

        // -------------------------------------------------
        // 6. Configure provider approval
        // -------------------------------------------------
        vault.setProviderApproval(
            provider,
            true
        );

        // -------------------------------------------------
        // 7. Connect StakeManager to vault
        // -------------------------------------------------
        vault.setStakeManager(
            address(stakeManager)
        );

        // -------------------------------------------------
        // 8. Fund owner
        // -------------------------------------------------
        usdc.mint(
            owner,
            1_000 * USDC
        );

        // -------------------------------------------------
        // 9. Fund provider
        // -------------------------------------------------
        usdc.mint(
            provider,
            100 * USDC
        );

        // -------------------------------------------------
        // 10. Fund vault
        // -------------------------------------------------
        usdc.approve(
            address(vault),
            1_000 * USDC
        );
        vault.deposit(
            100 * USDC
        );
        vm.stopPrank();

        // -------------------------------------------------
        // 11. Register provider
        // -------------------------------------------------
        vm.prank(provider);
        registry.registerProvider(
            "GPU_COMPUTE",
            "https://provider.example"
        );

        // -------------------------------------------------
        // 12. Provider stakes minimum required amount
        // -------------------------------------------------
        vm.startPrank(provider);
        usdc.approve(
            address(stakeManager),
            MINIMUM_STAKE
        );
        stakeManager.stake(
            MINIMUM_STAKE
        );
        vm.stopPrank();
    }

    function testInitialFunding() public {
        assertEq(
            usdc.balanceOf(address(vault)),
            100 * USDC
        );
    }

    function testAgentCanPayApprovedProvider() public {
        bytes32 requestId =
            keccak256("request-1");

        vm.prank(agent);

        vault.pay(
            requestId,
            provider,
            10 * USDC
        );

        assertEq(
            usdc.balanceOf(provider),
            60 * USDC
        );

        assertEq(
            vault.totalSpent(),
            10 * USDC
        );

        assertEq(
            vault.dailySpent(),
            10 * USDC
        );
    }

    function testUnauthorizedWalletCannotPay() public {
        bytes32 requestId =
            keccak256("attack");

        vm.prank(attacker);

        vm.expectRevert(
            AgentSpendingVault.UnauthorizedAgent.selector
        );

        vault.pay(
            requestId,
            provider,
            10 * USDC
        );
    }

    function testIneligibleProviderReverts() public {
        address unregisteredProvider =
            address(0xD00D);

        bytes32 requestId =
            keccak256("unknown-provider");

        vm.prank(agent);

        vm.expectRevert(
            AgentSpendingVault.ProviderNotEligible.selector
        );

        vault.pay(
            requestId,
            unregisteredProvider,
            10 * USDC
        );
    }

    function testPaymentAbovePerTxCapReverts() public {
        bytes32 requestId =
            keccak256("per-tx");

        vm.prank(agent);

        vm.expectRevert(
            AgentSpendingVault.PerTxCapExceeded.selector
        );

        vault.pay(
            requestId,
            provider,
            26 * USDC
        );
    }

    function testTotalCapReverts() public {
        vm.prank(owner);

        vault.setPolicy(
            100 * USDC,
            100 * USDC,
            100 * USDC
        );

        vm.startPrank(agent);

        vault.pay(
            keccak256("total-1"),
            provider,
            60 * USDC
        );

        vm.expectRevert(
            AgentSpendingVault.TotalCapExceeded.selector
        );

        vault.pay(
            keccak256("total-2"),
            provider,
            41 * USDC
        );

        vm.stopPrank();
    }

    function testDailyCapReverts() public {
        vm.startPrank(agent);

        vault.pay(
            keccak256("daily-1"),
            provider,
            25 * USDC
        );

        vault.pay(
            keccak256("daily-2"),
            provider,
            25 * USDC
        );

        vm.expectRevert(
            AgentSpendingVault.DailyCapExceeded.selector
        );

        vault.pay(
            keccak256("daily-3"),
            provider,
            1 * USDC
        );

        vm.stopPrank();
    }

    function testDailyCapResetsAfter24Hours() public {
        vm.startPrank(agent);

        vault.pay(
            keccak256("daily-reset-1"),
            provider,
            25 * USDC
        );

        vault.pay(
            keccak256("daily-reset-2"),
            provider,
            25 * USDC
        );

        vm.stopPrank();

        assertEq(
            vault.remainingDailyAllowance(),
            0
        );

        vm.warp(
            block.timestamp + 1 days
        );

        assertEq(
            vault.remainingDailyAllowance(),
            50 * USDC
        );
    }

    function testDuplicateRequestIdReverts() public {
        bytes32 requestId =
            keccak256("duplicate");

        vm.startPrank(agent);

        vault.pay(
            requestId,
            provider,
            10 * USDC
        );

        vm.expectRevert(
            AgentSpendingVault.RequestAlreadyUsed.selector
        );

        vault.pay(
            requestId,
            provider,
            10 * USDC
        );

        vm.stopPrank();
    }

    function testFrontendBypassCannotOverspend() public {
        vm.prank(owner);

        vault.setPolicy(
            100 * USDC,
            100 * USDC,
            100 * USDC
        );

        vm.startPrank(agent);

        vault.pay(
            keccak256("legitimate-1"),
            provider,
            25 * USDC
        );

        vault.pay(
            keccak256("legitimate-2"),
            provider,
            17 * USDC
        );

        vm.stopPrank();

        assertEq(
            vault.remainingAllowance(),
            58 * USDC
        );

        vm.prank(agent);

        vm.expectRevert(
            AgentSpendingVault.TotalCapExceeded.selector
        );

        vault.pay(
            keccak256("malicious-overspend"),
            provider,
            70 * USDC
        );
    }

    function testInsufficientVaultBalanceReverts() public {
        vm.prank(owner);

        vault.withdraw(
            owner,
            90 * USDC
        );

        vm.prank(agent);

        vm.expectRevert(
            AgentSpendingVault.InsufficientVaultBalance.selector
        );

        vault.pay(
            keccak256("insufficient"),
            provider,
            25 * USDC
        );
    }

    function testAgentCannotChangePolicy() public {
        vm.prank(agent);

        vm.expectRevert();

        vault.setPolicy(
            1_000_000 * USDC,
            1_000_000 * USDC,
            1_000_000 * USDC
        );
    }

    function testAgentCannotWithdraw() public {
        vm.prank(agent);

        vm.expectRevert();

        vault.withdraw(
            agent,
            10 * USDC
        );
    }

    function testPausedVaultRejectsPayment() public {
        vm.prank(owner);

        vault.pause();

        vm.prank(agent);

        vm.expectRevert();

        vault.pay(
            keccak256("paused"),
            provider,
            10 * USDC
        );
    }

    function testUnpauseAllowsPayment() public {
        vm.startPrank(owner);

        vault.pause();
        vault.unpause();

        vm.stopPrank();

        vm.prank(agent);

        vault.pay(
            keccak256("unpaused"),
            provider,
            10 * USDC
        );

        assertEq(
            usdc.balanceOf(provider),
            60 * USDC
        );
    }

    function testInvalidPolicyReverts() public {
        vm.startPrank(owner);

        vm.expectRevert(
            AgentSpendingVault.InvalidPolicy.selector
        );

        vault.setPolicy(
            100 * USDC,
            101 * USDC,
            50 * USDC
        );

        vm.stopPrank();
    }
}