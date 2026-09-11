// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PaymentEscrow} from "../src/PaymentEscrow.sol";
import {StakeManager} from "../src/StakeManager.sol";

/// @title ConfigurePhase4
/// @notice Post-deployment wiring script.
///         Authorizes the vault as a job creator on
///         PaymentEscrow and authorizes escrow as a
///         locker on StakeManager.
contract ConfigurePhase4 is Script {
    function run() external {
        address escrowAddr = vm.envAddress("PAYMENT_ESCROW_ADDRESS");
        address stakeManagerAddr = vm.envAddress("STAKE_MANAGER_ADDRESS");
        address vaultAddr = vm.envAddress("AGENT_VAULT_ADDRESS");

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        PaymentEscrow escrow = PaymentEscrow(escrowAddr);
        StakeManager manager = StakeManager(stakeManagerAddr);

        vm.startBroadcast(deployerKey);

        // Authorize vault as a job creator
        escrow.setCreatorAuthorization(vaultAddr, true);

        console.log("Vault authorized as creator:", vaultAddr);

        // Authorize escrow as a locker on StakeManager
        manager.setLockerAuthorization(escrowAddr, true);

        console.log("Escrow authorized as locker:", escrowAddr);

        vm.stopBroadcast();
    }
}
