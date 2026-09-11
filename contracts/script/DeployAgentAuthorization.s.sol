// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {AgentAuthorization} from "../src/AgentAuthorization.sol";

contract DeployAgentAuthorization is Script {
    function run(address owner, address spendingVault) external returns (AgentAuthorization authorization) {
        vm.startBroadcast();

        authorization = new AgentAuthorization(owner, spendingVault);

        vm.stopBroadcast();
    }
}
