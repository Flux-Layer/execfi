// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IXPRegistry {
    function addXpWithSig(
        address user,
        uint256 gameId,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external;

    function getNonce(address account, uint256 gameId) external view returns (uint256);

    function domainSeparator() external view returns (bytes32);
}
