// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";

interface IAgentAuthorizationConfig {
    function setRouterAuthorization(address router, bool authorized) external;
}

interface IPaymentFirewallConfig {
    function setEvaluatorAuthorization(address evaluator, bool authorized) external;

    function setRecorderAuthorization(address recorder, bool authorized) external;
}

contract ConfigureLiveContracts is Script {
    function run() external {
        address agentAuthorization = vm.envAddress("AGENT_AUTHORIZATION_ADDRESS");

        address paymentFirewall = vm.envAddress("PAYMENT_FIREWALL_ADDRESS");

        address paymentRouter = vm.envAddress("PAYMENT_ROUTER_ADDRESS");

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        // AgentAuthorization → PaymentRouter
        IAgentAuthorizationConfig(agentAuthorization).setRouterAuthorization(paymentRouter, true);

        // PaymentFirewall → PaymentRouter evaluator
        IPaymentFirewallConfig(paymentFirewall).setEvaluatorAuthorization(paymentRouter, true);

        // PaymentFirewall → PaymentRouter recorder
        IPaymentFirewallConfig(paymentFirewall).setRecorderAuthorization(paymentRouter, true);

        vm.stopBroadcast();
    }
}
