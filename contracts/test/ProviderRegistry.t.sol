// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ProviderRegistry} from "../src/ProviderRegistry.sol";

contract ProviderRegistryTest is Test {
    ProviderRegistry registry;

    address owner = address(1);
    address provider = address(2);
    address attacker = address(3);

    function setUp() public {
        registry = new ProviderRegistry(owner);
    }

    function testProviderCanRegister() public {
        vm.prank(provider);

        registry.registerProvider("AI", "https://provider.example");

        assertTrue(registry.isRegistered(provider));

        assertTrue(registry.isActive(provider));
    }

    function testDuplicateRegistrationReverts() public {
        vm.startPrank(provider);

        registry.registerProvider("AI", "https://provider.example");

        vm.expectRevert(ProviderRegistry.ProviderAlreadyRegistered.selector);

        registry.registerProvider("AI", "https://provider.example");

        vm.stopPrank();
    }

    function testEmptyServiceTypeReverts() public {
        vm.prank(provider);

        vm.expectRevert(ProviderRegistry.InvalidServiceType.selector);

        registry.registerProvider("", "https://provider.example");
    }

    function testEmptyEndpointReverts() public {
        vm.prank(provider);

        vm.expectRevert(ProviderRegistry.InvalidEndpoint.selector);

        registry.registerProvider("AI", "");
    }

    function testOwnerCanDeactivateProvider() public {
        vm.prank(provider);

        registry.registerProvider("AI", "https://provider.example");

        vm.prank(owner);

        registry.setProviderActive(provider, false);

        assertFalse(registry.isActive(provider));

        assertTrue(registry.isRegistered(provider));
    }

    function testUnauthorizedStatusChangeReverts() public {
        vm.prank(provider);

        registry.registerProvider("AI", "https://provider.example");

        vm.prank(attacker);

        vm.expectRevert();

        registry.setProviderActive(provider, false);
    }
}
