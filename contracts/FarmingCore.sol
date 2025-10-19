// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./libs/Structs.sol";
import "./libs/Errors.sol";
import "./libs/Events.sol";
import "./ParameterRegistry.sol";
import "./Item1155.sol";
import "./Land721.sol";
import "./interfaces/IXPRegistry.sol";

/**
 * @title FarmingCore
 * @notice Core gameplay contract for Greenvale farming: handles planting, optional watering,
 *         harvesting with XP forwarding, and tool management.
 */
contract FarmingCore is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    uint8 public constant MAX_SEEDS_PER_PLOT = 5;

    struct PlotInfo {
        address owner;
        uint8 seedCount;
        uint8 toolRarity;
        uint32[MAX_SEEDS_PER_PLOT] seedTypes;
        uint64 plantedAt;
        uint64 readyAt;
        bool harvested;
        bool dug;
    }

    ParameterRegistry public parameterRegistry;
    Item1155 public item1155;
    Land721 public land721;
    IXPRegistry public xpRegistry;
    uint256 public gameId;
    uint16 private _maxPlotsPerHarvest;

    mapping(uint256 => PlotInfo) private _plots; // landId => plot
    mapping(address => uint256) private _activeTool;

    uint256 private constant TOOL_TOKEN_BASE = 100_000;
    uint256 private constant SEED_TOKEN_BASE = 200_000;
    uint256 private constant WATER_TOKEN_ID = 300_000;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        address parameterRegistry_,
        address item1155_,
        address land721_,
        address xpRegistry_,
        uint256 gameId_
    ) external initializer {
        if (
            admin == address(0) || parameterRegistry_ == address(0) || item1155_ == address(0) || land721_ == address(0)
                || xpRegistry_ == address(0)
        ) {
            revert ZeroAddress();
        }

        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);

        parameterRegistry = ParameterRegistry(parameterRegistry_);
        item1155 = Item1155(item1155_);
        land721 = Land721(land721_);
        xpRegistry = IXPRegistry(xpRegistry_);
        gameId = gameId_;
        _maxPlotsPerHarvest = parameterRegistry.maxPlotsPerHarvest();
    }

    function setActiveTool(uint256 toolTokenId) external whenNotPaused {
        if (toolTokenId == 0) {
            delete _activeTool[msg.sender];
            emit ActiveToolSet(msg.sender, 0);
            return;
        }

        if (toolTokenId < TOOL_TOKEN_BASE || toolTokenId >= SEED_TOKEN_BASE) revert InvalidValue();
        if (item1155.balanceOf(msg.sender, toolTokenId) == 0) revert Unauthorized();

        _activeTool[msg.sender] = toolTokenId;
        emit ActiveToolSet(msg.sender, toolTokenId);
    }

    function activeTool(address account) external view returns (uint256) {
        return _activeTool[account];
    }

    function plant(uint256 landId, uint32[] calldata seedTypes) external whenNotPaused nonReentrant {
        _requireLandOwner(landId, msg.sender);

        uint256 seedCount = seedTypes.length;
        if (seedCount == 0 || seedCount > MAX_SEEDS_PER_PLOT) revert InvalidValue();

        PlotInfo storage plot = _plots[landId];
        if (!plot.dug) revert PlotNotDug(landId);
        if (plot.seedCount != 0) revert PlotOccupied(landId);

        uint16 toolSpeedBps = _getToolSpeedFromRarity(plot.toolRarity);
        uint64 plantedAt = uint64(block.timestamp);
        uint32 maxGrowthSeconds;

        for (uint256 i; i < seedCount; ++i) {
            uint32 seedType = seedTypes[i];
            SeedConfig memory seedCfg = parameterRegistry.getSeedConfig(seedType);
            uint32 adjustedGrowth = _applyToolModifier(seedCfg.growthSeconds, toolSpeedBps);
            if (adjustedGrowth > maxGrowthSeconds) {
                maxGrowthSeconds = adjustedGrowth;
            }

            item1155.burn(msg.sender, _seedTokenId(seedType), 1);
            plot.seedTypes[i] = seedType;
        }

        item1155.burn(msg.sender, WATER_TOKEN_ID, seedCount);

        plot.owner = msg.sender;
        plot.seedCount = uint8(seedCount);
        plot.plantedAt = plantedAt;
        plot.readyAt = plantedAt + maxGrowthSeconds;
        plot.harvested = false;
        plot.dug = false;

        emit PlotPlanted(msg.sender, landId, seedTypes, plot.readyAt);
    }

    function water(uint256 landId) external whenNotPaused nonReentrant {
        PlotInfo storage plot = _plots[landId];
        _validatePlotOwner(plot, landId, msg.sender);
        if (plot.seedCount == 0) revert PlotEmpty(landId);
        if (plot.harvested) revert PlotAlreadyHarvested(landId);

        item1155.burn(msg.sender, WATER_TOKEN_ID, 1);

        if (plot.readyAt > block.timestamp) {
            uint64 remaining = plot.readyAt - uint64(block.timestamp);
            uint64 totalDuration = plot.readyAt - plot.plantedAt;
            uint64 reduction = totalDuration / 5;
            if (reduction == 0) {
                reduction = 1;
            }
            if (reduction >= remaining) {
                plot.readyAt = uint64(block.timestamp);
            } else {
                plot.readyAt -= reduction;
            }
        }

        emit PlotWatered(msg.sender, landId, plot.readyAt);
    }

    function clearPlot(uint256 landId) external whenNotPaused {
        PlotInfo storage plot = _plots[landId];
        _validatePlotOwner(plot, landId, msg.sender);
        if (plot.seedCount != 0 && !plot.harvested) revert PlotNotEmpty(landId);

        _clearSeeds(plot);
        plot.toolRarity = 0;
        plot.plantedAt = 0;
        plot.readyAt = 0;
        plot.harvested = true;
        plot.dug = false;

        emit PlotCleared(msg.sender, landId);
    }

    function harvestAndClaimXP(uint256[] calldata landIds, uint256 expAmount, uint256 deadline, bytes calldata signature)
        external
        whenNotPaused
        nonReentrant
    {
        uint256 length = landIds.length;
        if (length == 0) revert InvalidValue();
        uint256 maxPlots = _maxPlotsPerHarvest;
        if (maxPlots == 0) {
            maxPlots = parameterRegistry.maxPlotsPerHarvest();
        }
        if (length > maxPlots) revert HarvestLimitExceeded(length, maxPlots);

        uint256 totalExp;
        uint16 seasonBonus = parameterRegistry.seasonBonusBps();
        uint256 remainingPlots = maxPlots;

        for (uint256 i; i < length; ++i) {
            if (remainingPlots == 0) revert HarvestLimitExceeded(length, maxPlots);
            unchecked {
                --remainingPlots;
            }
            uint256 landId = landIds[i];
            PlotInfo storage plot = _plots[landId];
            _validatePlotOwner(plot, landId, msg.sender);
            if (plot.seedCount == 0) revert PlotEmpty(landId);
            if (plot.harvested) revert PlotAlreadyHarvested(landId);
            if (block.timestamp < plot.readyAt) revert PlotNotReady(landId, plot.readyAt);

            plot.harvested = true;

            (uint256 plotExp, uint32[] memory plantedSeeds) = _calculatePlotExpAndSeeds(plot, seasonBonus);
            totalExp += plotExp;

            emit PlotHarvested(msg.sender, landId, plotExp, plantedSeeds);
            _clearSeeds(plot);
            plot.dug = false;
            plot.toolRarity = 0;
        }

        if (totalExp != expAmount) revert InvalidValue();
        if (totalExp > parameterRegistry.xpRateLimitPerTx()) revert InvalidValue();
        if (block.timestamp > deadline) revert SignatureExpired(deadline);

        xpRegistry.addXpWithSig(msg.sender, gameId, expAmount, deadline, signature);
        emit XpClaimed(msg.sender, gameId, expAmount, xpRegistry.getNonce(msg.sender, gameId));
    }

    function getPlot(uint256 landId) external view returns (PlotInfo memory) {
        return _plots[landId];
    }

    function maxPlotsPerHarvest() external view returns (uint256) {
        return _maxPlotsPerHarvest == 0 ? parameterRegistry.maxPlotsPerHarvest() : _maxPlotsPerHarvest;
    }

    function syncMaxPlotsPerHarvest() external onlyRole(MANAGER_ROLE) {
        uint16 latest = parameterRegistry.maxPlotsPerHarvest();
        if (latest == 0) revert InvalidValue();
        _maxPlotsPerHarvest = latest;
    }

    function dig(uint256 landId) external whenNotPaused nonReentrant {
        PlotInfo storage plot = _plots[landId];
        _requireLandOwner(landId, msg.sender);
        if (plot.owner != address(0) && plot.owner != msg.sender) revert NotLandOwner(landId, msg.sender, plot.owner);
        if (plot.seedCount != 0 && !plot.harvested) revert PlotOccupied(landId);
        if (plot.dug) revert PlotAlreadyDug(landId);

        uint256 toolId = _activeTool[msg.sender];
        uint8 toolRarity;
        if (toolId != 0) {
            if (toolId < TOOL_TOKEN_BASE || toolId >= SEED_TOKEN_BASE) revert InvalidValue();
            toolRarity = uint8(toolId - TOOL_TOKEN_BASE);
            parameterRegistry.getToolSpeedBps(toolRarity); // ensures configured
        }

        if (plot.owner == address(0)) {
            plot.owner = msg.sender;
        }

        _clearSeeds(plot);
        plot.toolRarity = toolRarity;
        plot.dug = true;
        plot.harvested = true;
        plot.plantedAt = 0;
        plot.readyAt = 0;

        emit PlotDug(msg.sender, landId, toolRarity);
    }

    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    function updateDependencies(address newParameterRegistry, address newItem1155, address newLand721, address newXpRegistry)
        external
        onlyRole(MANAGER_ROLE)
    {
        if (
            newParameterRegistry == address(0) || newItem1155 == address(0) || newLand721 == address(0)
                || newXpRegistry == address(0)
        ) {
            revert ZeroAddress();
        }
        parameterRegistry = ParameterRegistry(newParameterRegistry);
        item1155 = Item1155(newItem1155);
        land721 = Land721(newLand721);
        xpRegistry = IXPRegistry(newXpRegistry);
        _maxPlotsPerHarvest = parameterRegistry.maxPlotsPerHarvest();
    }

    function _seedTokenId(uint32 seedType) private pure returns (uint256) {
        return SEED_TOKEN_BASE + seedType;
    }

    function _requireLandOwner(uint256 landId, address account) private view {
        address owner = land721.ownerOf(landId);
        if (owner != account) revert NotLandOwner(landId, account, owner);
    }

    function _validatePlotOwner(PlotInfo storage plot, uint256 landId, address account) private view {
        if (plot.owner == address(0)) revert PlotNotFound(landId);
        if (plot.owner != account) revert NotLandOwner(landId, account, plot.owner);
    }

    function _applyToolModifier(uint32 baseGrowthSeconds, uint16 speedBps) private pure returns (uint32) {
        if (speedBps == 0) return baseGrowthSeconds;
        uint256 adjusted = (uint256(baseGrowthSeconds) * 10_000) / (10_000 + speedBps);
        if (adjusted == 0) {
            adjusted = 1;
        }
        return uint32(adjusted);
    }

    function _calculateExp(uint32 seedType, uint16 seasonBonusBps) private view returns (uint256) {
        SeedConfig memory seedCfg = parameterRegistry.getSeedConfig(seedType);
        uint256 base = seedCfg.baseExp;
        return (base * (10_000 + seasonBonusBps)) / 10_000;
    }

    function _resetPlot(PlotInfo storage plot) private {
        _clearSeeds(plot);
        plot.toolRarity = 0;
        plot.plantedAt = 0;
        plot.readyAt = 0;
        plot.harvested = false;
        plot.dug = false;
    }

    function _calculatePlotExpAndSeeds(PlotInfo storage plot, uint16 seasonBonus)
        private
        view
        returns (uint256 totalExp, uint32[] memory seeds)
    {
        uint256 count = plot.seedCount;
        seeds = new uint32[](count);
        for (uint256 i; i < count; ++i) {
            uint32 seedType = plot.seedTypes[i];
            seeds[i] = seedType;
            totalExp += _calculateExp(seedType, seasonBonus);
        }
    }

    function _clearSeeds(PlotInfo storage plot) private {
        for (uint256 i; i < MAX_SEEDS_PER_PLOT; ++i) {
            plot.seedTypes[i] = 0;
        }
        plot.seedCount = 0;
    }

    function _getToolSpeedFromRarity(uint8 rarity) private view returns (uint16) {
        if (rarity == 0) return 0;
        return parameterRegistry.getToolSpeedBps(rarity);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
