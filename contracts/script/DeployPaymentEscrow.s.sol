// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {PaymentEscrow} from "../src/PaymentEscrow.sol";

contract DeployPaymentEscrow is Script {
    function run() external returns (PaymentEscrow escrow) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address registry = vm.envAddress("PROVIDER_REGISTRY");
        address stakeManager = vm.envAddress("STAKE_MANAGER_ADDRESS");
        address verifier = vm.envAddress("DELIVERY_VERIFIER_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        escrow = new PaymentEscrow(deployer, usdc, registry, stakeManager, verifier, treasury);

        vm.stopBroadcast();
    }
}
