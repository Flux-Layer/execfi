// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ICoinFlipVault
 * @notice Interface for vault contracts that escrow and settle coin flip wagers.
 */
interface ICoinFlipVault {
    function settle(
        address user,
        uint64 sessionId,
        uint256 submittedGameId,
        uint256 multiplierX100,
        uint8 outcome,
        uint8 guess
    ) external;

    function gameId() external view returns (uint256);
}
