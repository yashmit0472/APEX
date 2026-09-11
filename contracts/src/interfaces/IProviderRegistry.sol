// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IProviderRegistry {
    struct Provider {
        bool registered;
        bool active;
        address owner;
        string serviceType;
        string endpoint;
        uint256 registeredAt;
    }

    function registerProvider(string calldata serviceType, string calldata endpoint) external;
    function setProviderActive(address provider, bool active) external;
    function isRegistered(address provider) external view returns (bool);
    function isActive(address provider) external view returns (bool);
    function getProvider(address provider) external view returns (Provider memory);
}
