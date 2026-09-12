// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {AgentAuthorization} from "../src/AgentAuthorization.sol";
import {PaymentFirewall} from "../src/PaymentFirewall.sol";

contract ConfigureRouter is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address authAddr = vm.envAddress("AGENT_AUTHORIZATION_ADDRESS");
        address firewallAddr = vm.envAddress("PAYMENT_FIREWALL_ADDRESS");
        address routerAddr = vm.envAddress("PAYMENT_ROUTER_ADDRESS");

        vm.startBroadcast(deployerKey);

        AgentAuthorization auth = AgentAuthorization(authAddr);
        PaymentFirewall firewall = PaymentFirewall(firewallAddr);

        // 1. Authorize router in AgentAuthorization
        auth.setRouterAuthorization(routerAddr, true);

        // 2. Authorize router as an evaluator in PaymentFirewall
        firewall.setEvaluatorAuthorization(routerAddr, true);

        // 3. Authorize router as a recorder in PaymentFirewall
        firewall.setRecorderAuthorization(routerAddr, true);

        vm.stopBroadcast();
    }
}
