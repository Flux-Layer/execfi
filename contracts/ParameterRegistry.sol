// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {SeedConfig, ShopItemConfig} from "./libs/Structs.sol";
import "./libs/Errors.sol";
import "./libs/Events.sol";

/**
 * @title ParameterRegistry
 * @notice Upgradeable storage for configurable gameplay parameters shared across
 *         the Greenvale farming ecosystem.
 */
contract ParameterRegistry is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant GAME_ADMIN_ROLE = keccak256("GAME_ADMIN_ROLE");

    mapping(uint256 => SeedConfig) private _seedConfigs;
    mapping(uint256 => bool) private _seedConfigured;

    mapping(uint256 => uint16) private _toolSpeedBps;
    mapping(uint256 => bool) private _toolConfigured;

    mapping(bytes32 => ShopItemConfig) private _shopItemConfigs;
    mapping(bytes32 => bool) private _shopItemExists;

    uint16 private _maxPlotsPerHarvest;
    uint16 private _seasonBonusBps;
    uint256 private _xpRateLimitPerTx;
    address private _treasury;
    uint16 private _marketFeeBps;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address treasury_, uint16 maxPlotsPerHarvest_, uint256 xpRateLimitPerTx_)
        external
        initializer
    {
        if (admin == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (maxPlotsPerHarvest_ == 0 || xpRateLimitPerTx_ == 0) revert InvalidValue();

        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GAME_ADMIN_ROLE, admin);

        _setTreasury(treasury_);
        _setMaxPlotsPerHarvest(maxPlotsPerHarvest_);
        _setXpRateLimitPerTx(xpRateLimitPerTx_);
    }

    function grantGameAdmin(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        grantRole(GAME_ADMIN_ROLE, account);
    }

    function revokeGameAdmin(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(GAME_ADMIN_ROLE, account);
    }

    function setSeedConfig(uint256 seedType, uint32 baseExp, uint32 growthSeconds)
        external
        onlyRole(GAME_ADMIN_ROLE)
    {
        _setSeedConfig(seedType, baseExp, growthSeconds);
    }

    function setSeedConfigs(uint256[] calldata seedTypes, uint32[] calldata baseExps, uint32[] calldata growthSeconds)
        external
        onlyRole(GAME_ADMIN_ROLE)
    {
        uint256 length = seedTypes.length;
        if (length == 0) revert InvalidValue();
        if (length != baseExps.length || length != growthSeconds.length) revert LengthMismatch();

        for (uint256 i; i < length; ++i) {
            _setSeedConfig(seedTypes[i], baseExps[i], growthSeconds[i]);
        }
    }

    function getSeedConfig(uint256 seedType) external view returns (SeedConfig memory) {
        if (!_seedConfigured[seedType]) revert InvalidSeedType(seedType);
        return _seedConfigs[seedType];
    }

    function getSeedConfigs(uint256[] calldata seedTypes) external view returns (SeedConfig[] memory configs) {
        uint256 length = seedTypes.length;
        configs = new SeedConfig[](length);
        for (uint256 i; i < length; ++i) {
            uint256 seedType = seedTypes[i];
            if (!_seedConfigured[seedType]) revert InvalidSeedType(seedType);
            configs[i] = _seedConfigs[seedType];
        }
    }

    function setToolSpeedBps(uint256 toolRarity, uint16 speedBps) external onlyRole(GAME_ADMIN_ROLE) {
        _setToolSpeedBps(toolRarity, speedBps);
    }

    function setToolSpeedBpsBatch(uint256[] calldata toolRarities, uint16[] calldata speedBpsValues)
        external
        onlyRole(GAME_ADMIN_ROLE)
    {
        uint256 length = toolRarities.length;
        if (length == 0) revert InvalidValue();
        if (length != speedBpsValues.length) revert LengthMismatch();

        for (uint256 i; i < length; ++i) {
            _setToolSpeedBps(toolRarities[i], speedBpsValues[i]);
        }
    }

    function getToolSpeedBps(uint256 toolRarity) external view returns (uint16) {
        if (!_toolConfigured[toolRarity]) revert InvalidToolRarity(toolRarity);
        return _toolSpeedBps[toolRarity];
    }

    function getToolSpeedBpsBatch(uint256[] calldata toolRarities) external view returns (uint16[] memory values) {
        uint256 length = toolRarities.length;
        values = new uint16[](length);
        for (uint256 i; i < length; ++i) {
            uint256 rarity = toolRarities[i];
            if (!_toolConfigured[rarity]) revert InvalidToolRarity(rarity);
            values[i] = _toolSpeedBps[rarity];
        }
    }

    function setShopItemConfig(bytes32 itemKey, uint128 price, bool active) external onlyRole(GAME_ADMIN_ROLE) {
        _setShopItemConfig(itemKey, price, active);
    }

    function setShopItemConfigs(bytes32[] calldata itemKeys, uint128[] calldata prices, bool[] calldata actives)
        external
        onlyRole(GAME_ADMIN_ROLE)
    {
        uint256 length = itemKeys.length;
        if (length == 0) revert InvalidValue();
        if (length != prices.length || length != actives.length) revert LengthMismatch();

        for (uint256 i; i < length; ++i) {
            _setShopItemConfig(itemKeys[i], prices[i], actives[i]);
        }
    }

    function getShopItemConfig(bytes32 itemKey) external view returns (ShopItemConfig memory) {
        if (!_shopItemExists[itemKey]) revert InvalidShopItem(itemKey);
        return _shopItemConfigs[itemKey];
    }

    function maxPlotsPerHarvest() external view returns (uint16) {
        return _maxPlotsPerHarvest;
    }

    function seasonBonusBps() external view returns (uint16) {
        return _seasonBonusBps;
    }

    function xpRateLimitPerTx() external view returns (uint256) {
        return _xpRateLimitPerTx;
    }

    function marketFeeBps() external view returns (uint16) {
        return _marketFeeBps;
    }

    function treasury() external view returns (address) {
        return _treasury;
    }

    function setMaxPlotsPerHarvest(uint16 newValue) external onlyRole(GAME_ADMIN_ROLE) {
        _setMaxPlotsPerHarvest(newValue);
    }

    function setSeasonBonusBps(uint16 newValue) external onlyRole(GAME_ADMIN_ROLE) {
        if (newValue > 10_000) revert InvalidValue();
        _seasonBonusBps = newValue;
        emit SeasonBonusBpsUpdated(newValue);
    }

    function setXpRateLimitPerTx(uint256 newValue) external onlyRole(GAME_ADMIN_ROLE) {
        _setXpRateLimitPerTx(newValue);
    }

    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTreasury(newTreasury);
    }

    function setMarketplaceFeeBps(uint16 newValue) external onlyRole(GAME_ADMIN_ROLE) {
        if (newValue > 10_000) revert InvalidValue();
        _marketFeeBps = newValue;
        emit MarketplaceFeeBpsUpdated(newValue);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function _setSeedConfig(uint256 seedType, uint32 baseExp, uint32 growthSeconds) internal {
        if (baseExp == 0 || growthSeconds == 0) revert InvalidValue();
        _seedConfigs[seedType] = SeedConfig({baseExp: baseExp, growthSeconds: growthSeconds});
        _seedConfigured[seedType] = true;
        emit SeedConfigUpdated(seedType, baseExp, growthSeconds);
    }

    function _setToolSpeedBps(uint256 toolRarity, uint16 speedBps) internal {
        if (speedBps > 10_000) revert InvalidValue();
        _toolSpeedBps[toolRarity] = speedBps;
        _toolConfigured[toolRarity] = true;
        emit ToolSpeedBpsUpdated(toolRarity, speedBps);
    }

    function _setShopItemConfig(bytes32 itemKey, uint128 price, bool active) internal {
        if (itemKey == bytes32(0)) revert InvalidShopItem(itemKey);
        if (active && price == 0) revert InvalidValue();

        _shopItemConfigs[itemKey] = ShopItemConfig({price: price, active: active});
        _shopItemExists[itemKey] = true;

        emit ShopItemConfigUpdated(itemKey, price, active);
    }

    function _setMaxPlotsPerHarvest(uint16 newValue) internal {
        if (newValue == 0) revert InvalidValue();
        _maxPlotsPerHarvest = newValue;
        emit MaxPlotsPerHarvestUpdated(newValue);
    }

    function _setXpRateLimitPerTx(uint256 newValue) internal {
        if (newValue == 0) revert InvalidValue();
        _xpRateLimitPerTx = newValue;
        emit XpRateLimitPerTxUpdated(newValue);
    }

    function _setTreasury(address newTreasury) internal {
        if (newTreasury == address(0)) revert ZeroAddress();
        address previousTreasury = _treasury;
        _treasury = newTreasury;
        emit TreasuryUpdated(previousTreasury, newTreasury);
    }

    uint256[38] private __gap;
}
