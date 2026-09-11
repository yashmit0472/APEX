// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDeliveryVerifier {

    function verify(
        uint256 jobId,
        bytes32 deliveryHash
    ) external view returns (bool);
}
