// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract MockUSDCTest is Test {
    MockUSDC internal usdc;
    address internal alice = address(0xA11CE);

    function setUp() public {
        usdc = new MockUSDC();
    }

    function testMetadata() public {
        assertEq(usdc.name(), "Mock USD Coin");
        assertEq(usdc.symbol(), "mUSDC");
        assertEq(usdc.decimals(), 6);
    }

    function testMint() public {
        uint256 amount = 100 * 10 ** 6;
        usdc.mint(alice, amount);
        assertEq(usdc.balanceOf(alice), amount);
    }
}
