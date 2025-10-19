// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Centralised custom errors for the Greenvale farming module.
 * Using string-free errors keeps revert reasons consistent and saves bytecode.
 */
error ZeroAddress();
error LengthMismatch();
error InvalidSeedType(uint256 seedType);
error InvalidToolRarity(uint256 toolRarity);
error InvalidShopItem(bytes32 itemKey);
error InvalidValue();
error HarvestLimitExceeded(uint256 attempted, uint256 maxAllowed);
error HarvestNotReady(uint256 landId, uint256 readyAt);
error PlotOccupied(uint256 landId);
error PlotEmpty(uint256 landId);
error NotLandOwner(uint256 landId, address expectedOwner, address actualOwner);
error SignatureExpired(uint256 deadline);
error SignatureInvalid();
error NonceMismatch(uint256 expected, uint256 provided);
error NotActiveTool(uint256 tokenId);
error InsufficientBalance();
error TransferFailed();
error Unauthorized();
error LandLimitReached(address account);
error PlotNotFound(uint256 landId);
error PlotNotReady(uint256 landId, uint256 readyAt);
error PlotAlreadyHarvested(uint256 landId);
error PlotNotDug(uint256 landId);
error PlotAlreadyDug(uint256 landId);
error PlotNotEmpty(uint256 landId);
