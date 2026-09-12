// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

interface IERC20 {
    function symbol() external view returns (string memory);
}

contract CheckUSDC is Script {
    function run() external {
        string memory sym = IERC20(0x5FbDB2315678afecb367f032d93F642f64180aa3).symbol();
        console.log("Symbol: %s", sym);
    }
}
