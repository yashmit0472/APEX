// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {DeliveryVerifier} from "../src/DeliveryVerifier.sol";

contract DeployDeliveryVerifier is Script {
    function run()
        external
        returns (DeliveryVerifier verifier)
    {
        uint256 deployerKey =
            vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        verifier = new DeliveryVerifier();

        vm.stopBroadcast();
    }
}
