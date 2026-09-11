// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {StakeManager} from "../src/StakeManager.sol";

contract DeployStakeManager is Script {
    function run() external returns (StakeManager manager) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address registry = vm.envAddress("PROVIDER_REGISTRY");

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        manager = new StakeManager(deployer, usdc, registry, 10 * 1e6);

        vm.stopBroadcast();
    }
}
