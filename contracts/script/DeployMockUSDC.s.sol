// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract DeployMockUSDC is Script {
    function run() external returns (MockUSDC token) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        token = new MockUSDC();

        vm.stopBroadcast();
    }
}
