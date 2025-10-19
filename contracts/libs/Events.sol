// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Shared event definitions for the Greenvale farming module.
 * Provides a single reference to keep on-chain logging consistent.
 */
event SeedConfigUpdated(uint256 indexed seedType, uint32 baseExp, uint32 growthSeconds);
event ToolSpeedBpsUpdated(uint256 indexed toolRarity, uint16 speedBps);
event MaxPlotsPerHarvestUpdated(uint16 maxPlotsPerHarvest);
event XpRateLimitPerTxUpdated(uint256 xpRateLimitPerTx);
event SeasonBonusBpsUpdated(uint16 seasonBonusBps);
event ShopItemConfigUpdated(bytes32 indexed itemKey, uint128 price, bool active);
event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
event MarketplaceFeeBpsUpdated(uint16 marketFeeBps);

event ActiveToolSet(address indexed account, uint256 indexed toolTokenId);
event PlotDug(address indexed farmer, uint256 indexed landId, uint8 toolRarity);
event PlotPlanted(address indexed farmer, uint256 indexed landId, uint32[] seedTypes, uint64 readyAt);
event PlotWatered(address indexed farmer, uint256 indexed landId, uint64 newReadyAt);
event PlotHarvested(address indexed farmer, uint256 indexed landId, uint256 expAmount, uint32[] seedTypes);
event PlotCleared(address indexed farmer, uint256 indexed landId);
event LandMinted(address indexed to, uint256 indexed landId);
event ShopPurchase(address indexed buyer, bytes32 indexed itemKey, uint256 quantity, uint256 totalPaid);

event MarketplaceListingCreated(
    bytes32 indexed listingId,
    address indexed seller,
    address indexed asset,
    uint256 tokenId,
    uint256 amount,
    uint128 pricePerUnit,
    address currency,
    uint64 expiry
);
event MarketplaceListingCancelled(bytes32 indexed listingId, address indexed seller);
event MarketplacePurchase(
    bytes32 indexed listingId,
    address indexed buyer,
    uint256 amountFilled,
    uint256 totalPaid,
    address feeRecipient,
    uint256 feeAmount
);

event XpClaimed(address indexed user, uint256 indexed gameId, uint256 amount, uint256 nonce);
