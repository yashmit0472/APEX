// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDeliveryVerifier} from "./interfaces/IDeliveryVerifier.sol";

/// @title DeliveryVerifier
/// @notice MVP verifier — simply checks that the
///         delivery hash is not zero.
///
///         This gives APEX a pluggable verification
///         architecture. Later the verifier could use:
///
///           Hash verification
///           Signature verification
///           Oracle
///           TEE attestation
///           ZK proof
///           Multi-validator consensus
contract DeliveryVerifier is IDeliveryVerifier {

    function verify(
        uint256,
        bytes32 deliveryHash
    ) external pure returns (bool) {
        return deliveryHash != bytes32(0);
    }
}
