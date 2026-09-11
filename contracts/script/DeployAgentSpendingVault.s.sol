// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {AgentSpendingVault} from "../src/AgentSpendingVault.sol";

contract DeployAgentSpendingVault is Script {
    function run()
        external
        returns (AgentSpendingVault vault)
    {
        address usdc =
            vm.envAddress("USDC_ADDRESS");

        address agent =
            vm.envAddress("AGENT_ADDRESS");

        uint256 deployerKey =
            vm.envUint("DEPLOYER_PRIVATE_KEY");

        address deployer =
            vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        vault = new AgentSpendingVault(
            deployer,
            usdc,
            agent
        );

        vm.stopBroadcast();
    }
}