// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgentAuthorization} from "./interfaces/IAgentAuthorization.sol";
import {IPaymentFirewall} from "./interfaces/IPaymentFirewall.sol";

contract PaymentRouter {
    IAgentAuthorization public immutable authorization;
    IPaymentFirewall public immutable firewall;

    mapping(bytes32 => IAgentAuthorization.PaymentIntent) private pendingIntents;

    error InvalidAddress();
    error InvalidRequestId();
    error UnauthorizedCaller();
    error RequestNotPending(bytes32 requestId);
    error UnauthorizedAgent(address caller, address agent);

    constructor(address authorization_, address firewall_) {
        if (authorization_ == address(0) || firewall_ == address(0)) {
            revert InvalidAddress();
        }

        authorization = IAgentAuthorization(authorization_);
        firewall = IPaymentFirewall(firewall_);
    }

    function execute(IAgentAuthorization.PaymentIntent calldata intent)
        external
        returns (uint256 jobId, uint256 score, IPaymentFirewall.Decision decision)
    {
        if (intent.requestId == bytes32(0)) {
            revert InvalidRequestId();
        }
        if (msg.sender != intent.agent) {
            revert UnauthorizedCaller();
        }

        if (msg.sender != intent.agent) {
            revert UnauthorizedAgent(msg.sender, intent.agent);
        }

        authorization.validateIntent(intent);
        (score, decision) = firewall.evaluate(intent.agent, intent.provider, intent.amount, intent.requestId);

        if (decision == IPaymentFirewall.Decision.REQUIRE_APPROVAL) {
            pendingIntents[intent.requestId] = intent;
            return (0, score, decision);
        }

        jobId = _executePayment(intent);
    }

    function executeApproved(bytes32 requestId) external returns (uint256 jobId) {
        if (requestId == bytes32(0)) {
            revert InvalidRequestId();
        }

        if (!firewall.isRequestApproved(requestId)) {
            revert RequestNotPending(requestId);
        }

        IAgentAuthorization.PaymentIntent memory intent = pendingIntents[requestId];
        if (intent.requestId == bytes32(0)) {
            revert RequestNotPending(requestId);
        }

        jobId = _executePayment(intent);
    }

    function getPendingIntent(bytes32 requestId) external view returns (IAgentAuthorization.PaymentIntent memory) {
        return pendingIntents[requestId];
    }

    function _executePayment(IAgentAuthorization.PaymentIntent memory intent) internal returns (uint256 jobId) {
        jobId = authorization.executePayment(intent);
        firewall.recordSuccessfulPayment(intent.agent, intent.provider);
        delete pendingIntents[intent.requestId];
    }
}
