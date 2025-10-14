// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IWagerVault {
    function settle(address user, uint64 sessionId, uint256 gameId, uint256 multiplierX100) external;

    function gameId() external view returns (uint256);
}
