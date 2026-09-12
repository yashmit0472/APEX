// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

interface IERC20Config {
    function approve(address spender, uint256 amount) external returns (bool);
    function mint(address to, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

interface IProviderRegistryConfig {
    function registerProvider(
        string calldata serviceType,
        string calldata endpoint
    ) external;

    function isRegistered(address provider) external view returns (bool);
}

interface IStakeManagerConfig {
    function minimumStake() external view returns (uint256);
    function stake(uint256 amount) external;
    function stakedBalance(address provider) external view returns (uint256);
}

interface IAgentSpendingVaultConfig {
    function setProviderApproval(
        address provider,
        bool approved
    ) external;

    function deposit(uint256 amount) external;
}

interface IAgentAuthorizationConfig {
    function authorizeAgent(
        address agent,
        address provider,
        bytes32 serviceId,
        uint256 maxSpend,
        uint256 perTxCap,
        uint256 dailyCap,
        uint256 expiresAt
    ) external;
}

contract SetupLivePayment is Script {
    uint256 internal constant USDC = 1e6;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        address deployer = vm.addr(deployerKey);

        address agent = vm.envAddress("AGENT_ADDRESS");
        address provider = vm.envAddress("PROVIDER_ADDRESS");

        address usdc = vm.envAddress("USDC_ADDRESS");
        address registry = vm.envAddress("PROVIDER_REGISTRY");
        address stakeManager = vm.envAddress("STAKE_MANAGER");
        address vault = vm.envAddress("AGENT_VAULT_ADDRESS");
        address authorization = vm.envAddress(
            "AGENT_AUTHORIZATION_ADDRESS"
        );

        bytes32 serviceId = keccak256("GPU_COMPUTE");

        vm.startBroadcast(deployerKey);

        // ------------------------------------------------------------
        // 1. Approve provider in the AgentSpendingVault
        // ------------------------------------------------------------
        IAgentSpendingVaultConfig(vault).setProviderApproval(
            provider,
            true
        );

        // ------------------------------------------------------------
        // 2. Configure the live agent authorization policy
        // ------------------------------------------------------------
        IAgentAuthorizationConfig(authorization).authorizeAgent(
            agent,
            provider,
            serviceId,
            100 * USDC, // max total spend
            25 * USDC,  // per transaction cap
            50 * USDC,  // daily cap
            block.timestamp + 1 days
        );

        // ------------------------------------------------------------
        // 3. Deposit USDC into the AgentSpendingVault
        // ------------------------------------------------------------
        IERC20Config(usdc).mint(deployer, 1000 * USDC);

        IERC20Config(usdc).approve(
            vault,
            100 * USDC
        );

        IAgentSpendingVaultConfig(vault).deposit(
            100 * USDC
        );

        vm.stopBroadcast();

        // ------------------------------------------------------------
        // 4. Print the minimum stake required by the live contract
        // ------------------------------------------------------------
        uint256 minimumStake =
            IStakeManagerConfig(stakeManager).minimumStake();

        console.log("Deployer: %s", deployer);
        console.log("Agent: %s", agent);
        console.log("Provider: %s", provider);
        console.log("USDC: %s", usdc);
        console.log("Registry: %s", registry);
        console.log("StakeManager: %s", stakeManager);
        console.log("Vault: %s", vault);
        console.log("Authorization: %s", authorization);

        console.log("Minimum stake: %s", minimumStake);
        console.log("Vault deposit: %s", 100 * USDC);
    }
}
