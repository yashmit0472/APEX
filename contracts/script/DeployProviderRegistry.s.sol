// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {ProviderRegistry} from "../src/ProviderRegistry.sol";

contract DeployProviderRegistry is Script {
    function run() external returns (ProviderRegistry registry) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        registry = new ProviderRegistry(deployer);

        vm.stopBroadcast();
    }
}