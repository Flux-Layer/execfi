// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ICoinFlip
 * @notice Minimal interface exposed by the CoinFlipGame contract.
 */
interface ICoinFlip {
    function sessionKey(address user, uint256 gameId, uint64 sessionId) external pure returns (bytes32);
    function sessionUsed(bytes32 key) external view returns (bool);
    function gameId() external view returns (uint256);
}
