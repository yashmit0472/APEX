// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StakeManager} from "../src/StakeManager.sol";
import {ProviderRegistry} from "../src/ProviderRegistry.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract StakeManagerTest is Test {
    MockUSDC token;
    ProviderRegistry registry;
    StakeManager stakeManager;

    address owner = address(1);
    address provider = address(2);
    address attacker = address(3);
    address locker = address(4);
    address treasury = address(5);

    uint256 constant MINIMUM_STAKE = 10_000_000;
    uint256 constant ONE_USDC = 1_000_000;

    function setUp() public {
        token = new MockUSDC();

        registry = new ProviderRegistry(owner);

        stakeManager = new StakeManager(
            owner,
            address(token),
            address(registry),
            MINIMUM_STAKE
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
    }

    function registerProvider() internal {
        vm.prank(provider);

        registry.registerProvider(
            "AI",
            "https://provider.example"
        );
    }

    function stakeAmount(uint256 amount) internal {
        registerProvider();

        vm.prank(provider);

        stakeManager.stake(amount);
    }

    function testProviderCanStake() public {
        stakeAmount(10 * ONE_USDC);

        assertEq(
            stakeManager.stakedBalance(provider),
            10 * ONE_USDC
        );
    }

    function testEligibilityBeforeAndAfterMinimumStake()
        public
    {
        registerProvider();

        assertFalse(
            stakeManager.isEligible(provider)
        );

        vm.prank(provider);

        stakeManager.stake(
            10 * ONE_USDC
        );

        assertTrue(
            stakeManager.isEligible(provider)
        );
    }

    function testUnregisteredProviderCannotStake()
        public
    {
        vm.prank(attacker);

        token.approve(
            address(stakeManager),
            type(uint256).max
        );

        vm.prank(attacker);

        vm.expectRevert(
            StakeManager.ProviderNotRegistered.selector
        );

        stakeManager.stake(
            10 * ONE_USDC
        );
    }

    function testBelowMinimumStakeIsNotEligible()
        public
    {
        stakeAmount(9 * ONE_USDC);

        assertFalse(
            stakeManager.isEligible(provider)
        );
    }

    function testFullEligiblePath() public {
        stakeAmount(10 * ONE_USDC);

        assertTrue(
            registry.isRegistered(provider)
        );

        assertTrue(
            registry.isActive(provider)
        );

        assertTrue(
            stakeManager.isEligible(provider)
        );
    }

    function testInactiveProviderBecomesIneligible()
        public
    {
        stakeAmount(10 * ONE_USDC);

        assertTrue(
            stakeManager.isEligible(provider)
        );

        vm.prank(owner);

        registry.setProviderActive(
            provider,
            false
        );

        assertFalse(
            stakeManager.isEligible(provider)
        );
    }

    function testWithdrawStake() public {
        stakeAmount(20 * ONE_USDC);

        vm.prank(provider);

        stakeManager.withdrawStake(
            10 * ONE_USDC
        );

        assertEq(
            stakeManager.stakedBalance(provider),
            10 * ONE_USDC
        );

        assertTrue(
            stakeManager.isEligible(provider)
        );
    }

    function testCannotWithdrawBelowMinimum()
        public
    {
        stakeAmount(20 * ONE_USDC);

        vm.prank(provider);

        vm.expectRevert(
            StakeManager.InsufficientStake.selector
        );

        stakeManager.withdrawStake(
            11 * ONE_USDC
        );
    }

    function testLockedStakeCannotBeWithdrawn()
        public
    {
        stakeAmount(100 * ONE_USDC);

        vm.prank(owner);

        stakeManager.setLockerAuthorization(
            locker,
            true
        );

        vm.prank(locker);

        stakeManager.lockStake(
            provider,
            40 * ONE_USDC
        );

        vm.prank(provider);

        vm.expectRevert(
            StakeManager.InsufficientAvailableStake.selector
        );

        stakeManager.withdrawStake(
            61 * ONE_USDC
        );
    }

    function testLockingStake() public {
        stakeAmount(100 * ONE_USDC);

        vm.prank(owner);

        stakeManager.setLockerAuthorization(
            locker,
            true
        );

        vm.prank(locker);

        stakeManager.lockStake(
            provider,
            30 * ONE_USDC
        );

        assertEq(
            stakeManager.lockedBalance(provider),
            30 * ONE_USDC
        );

        assertEq(
            stakeManager.availableStake(provider),
            70 * ONE_USDC
        );
    }

    function testUnlockStake() public {
        stakeAmount(100 * ONE_USDC);

        vm.prank(owner);

        stakeManager.setLockerAuthorization(
            locker,
            true
        );

        vm.startPrank(locker);

        stakeManager.lockStake(
            provider,
            30 * ONE_USDC
        );

        stakeManager.unlockStake(
            provider,
            30 * ONE_USDC
        );

        vm.stopPrank();

        assertEq(
            stakeManager.lockedBalance(provider),
            0
        );

        assertEq(
            stakeManager.availableStake(provider),
            100 * ONE_USDC
        );
    }

    function testUnauthorizedLockReverts()
        public
    {
        stakeAmount(100 * ONE_USDC);

        vm.prank(attacker);

        vm.expectRevert(
            StakeManager.UnauthorizedLocker.selector
        );

        stakeManager.lockStake(
            provider,
            30 * ONE_USDC
        );
    }

    function testSlash() public {
        stakeAmount(100 * ONE_USDC);

        vm.prank(owner);

        stakeManager.setLockerAuthorization(
            locker,
            true
        );

        uint256 treasuryBefore =
            token.balanceOf(treasury);

        vm.prank(locker);

        stakeManager.slash(
            provider,
            10 * ONE_USDC,
            treasury
        );

        assertEq(
            stakeManager.stakedBalance(provider),
            90 * ONE_USDC
        );

        assertEq(
            token.balanceOf(treasury),
            treasuryBefore +
            10 * ONE_USDC
        );
    }

    function testUnauthorizedSlashReverts()
        public
    {
        stakeAmount(100 * ONE_USDC);

        vm.prank(attacker);

        vm.expectRevert(
            StakeManager.UnauthorizedLocker.selector
        );

        stakeManager.slash(
            provider,
            10 * ONE_USDC,
            treasury
        );
    }
}