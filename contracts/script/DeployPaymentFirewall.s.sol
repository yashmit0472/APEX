// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {PaymentFirewall} from "../src/PaymentFirewall.sol";

contract DeployPaymentFirewall is Script {
    function run() external returns (PaymentFirewall firewall) {
        address spendingVault = vm.envAddress("AGENT_VAULT_ADDRESS");
        address stakeManager = vm.envAddress("STAKE_MANAGER_ADDRESS");

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        firewall = new PaymentFirewall(deployer, spendingVault, stakeManager);

        vm.stopBroadcast();
    }
}
