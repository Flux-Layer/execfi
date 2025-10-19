// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Shared data structures for the Greenvale farming module.
struct SeedConfig {
    uint32 baseExp;
    uint32 growthSeconds;
}

struct ToolConfig {
    uint16 speedBps;
}

struct ShopItemConfig {
    uint128 price;
    bool active;
}

struct PlotState {
    uint32 seedType;
    uint64 plantedAt;
    uint64 readyAt;
    uint8 toolRarity;
    bool harvested;
}

struct MarketplaceListing {
    address seller;
    address asset;
    uint256 tokenId;
    uint128 pricePerUnit;
    uint64 amount;
    uint64 expiry;
    bool is1155;
}
