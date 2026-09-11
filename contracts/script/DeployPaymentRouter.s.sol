// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";

contract DeployPaymentRouter is Script {
    function run() external returns (PaymentRouter router) {
        address authorization = vm.envAddress("AGENT_AUTHORIZATION_ADDRESS");
        address firewall = vm.envAddress("PAYMENT_FIREWALL_ADDRESS");

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        router = new PaymentRouter(authorization, firewall);

        vm.stopBroadcast();
    }
}
