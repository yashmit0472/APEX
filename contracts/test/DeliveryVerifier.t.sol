// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DeliveryVerifier} from "../src/DeliveryVerifier.sol";

contract DeliveryVerifierTest is Test {
    DeliveryVerifier verifier;

    bytes32 constant VALID_HASH = keccak256("result_v1");

    function setUp() public {
        verifier = new DeliveryVerifier();
    }

    function testVerifyReturnsTrueForValidHash() public view {
        assertTrue(verifier.verify(0, VALID_HASH));
    }

    function testVerifyReturnsFalseForZeroHash() public view {
        assertFalse(verifier.verify(0, bytes32(0)));
    }

    function testVerifyWithDifferentJobIds() public view {
        assertTrue(verifier.verify(1, VALID_HASH));

        assertTrue(verifier.verify(999, VALID_HASH));
    }

    function testFuzzVerify(uint256 jobId, bytes32 hash) public view {
        bool result = verifier.verify(jobId, hash);

        assertEq(result, hash != bytes32(0));
    }
}
