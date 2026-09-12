// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {AgentAuthorization} from "../src/AgentAuthorization.sol";

contract DeployAgentAuthorization is Script {
    function run() external returns (AgentAuthorization authorization) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.addr(deployerKey);
        address spendingVault = vm.envAddress("AGENT_VAULT_ADDRESS");

        vm.startBroadcast(deployerKey);

        authorization = new AgentAuthorization(owner, spendingVault);

        vm.stopBroadcast();
    }
}
