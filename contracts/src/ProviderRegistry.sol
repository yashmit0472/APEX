// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ProviderRegistry is Ownable {
    struct Provider {
        bool registered;
        bool active;
        address owner;
        string serviceType;
        string endpoint;
        uint256 registeredAt;
    }

    mapping(address => Provider) private providers;

    error ProviderAlreadyRegistered();
    error ProviderNotRegistered();
    error InvalidProvider();
    error InvalidServiceType();
    error InvalidEndpoint();
    error UnauthorizedProvider();

    event ProviderRegistered(
        address indexed provider,
        string serviceType,
        string endpoint
    );

    event ProviderStatusUpdated(
        address indexed provider,
        bool active
    );

    event ProviderMetadataUpdated(
        address indexed provider,
        string serviceType,
        string endpoint
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    function registerProvider(
        string calldata serviceType,
        string calldata endpoint
    ) external {
        if (providers[msg.sender].registered) {
            revert ProviderAlreadyRegistered();
        }

        if (bytes(serviceType).length == 0) {
            revert InvalidServiceType();
        }

        if (bytes(endpoint).length == 0) {
            revert InvalidEndpoint();
        }

        providers[msg.sender] = Provider({
            registered: true,
            active: true,
            owner: msg.sender,
            serviceType: serviceType,
            endpoint: endpoint,
            registeredAt: block.timestamp
        });

        emit ProviderRegistered(
            msg.sender,
            serviceType,
            endpoint
        );
    }

    function setProviderActive(
        address provider,
        bool active
    ) external onlyOwner {
        if (provider == address(0)) {
            revert InvalidProvider();
        }

        if (!providers[provider].registered) {
            revert ProviderNotRegistered();
        }

        providers[provider].active = active;

        emit ProviderStatusUpdated(provider, active);
    }

    function updateProviderMetadata(
        string calldata serviceType,
        string calldata endpoint
    ) external {
        Provider storage provider = providers[msg.sender];

        if (!provider.registered) {
            revert ProviderNotRegistered();
        }

        if (bytes(serviceType).length == 0) {
            revert InvalidServiceType();
        }

        if (bytes(endpoint).length == 0) {
            revert InvalidEndpoint();
        }

        provider.serviceType = serviceType;
        provider.endpoint = endpoint;

        emit ProviderMetadataUpdated(
            msg.sender,
            serviceType,
            endpoint
        );
    }

    function isRegistered(
        address provider
    ) public view returns (bool) {
        return providers[provider].registered;
    }

    function isActive(
        address provider
    ) public view returns (bool) {
        return providers[provider].registered &&
            providers[provider].active;
    }

    function getProvider(
        address provider
    ) external view returns (Provider memory) {
        if (!providers[provider].registered) {
            revert ProviderNotRegistered();
        }

        return providers[provider];
    }
}