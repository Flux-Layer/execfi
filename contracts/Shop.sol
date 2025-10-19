// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./ParameterRegistry.sol";
import "./Item1155.sol";
import "./Land721.sol";
import "./libs/Errors.sol";
import "./libs/Events.sol";
import "./libs/Structs.sol";

/**
 * @title Shop
 * @notice Fixed-price storefront for Greenvale assets. Prices and availability
 *         are sourced from ParameterRegistry so they remain admin configurable.
 *         Handles minting of Item1155 (seeds, tools, water) and Land721 plots.
 */
contract Shop is Initializable, AccessControlUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    bytes32 public constant TREASURY_MANAGER_ROLE = keccak256("TREASURY_MANAGER_ROLE");

    ParameterRegistry public parameterRegistry;
    Item1155 public item1155;
    Land721 public land721;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        address parameterRegistry_,
        address item1155_,
        address land721_
    ) external initializer {
        if (admin == address(0) || parameterRegistry_ == address(0) || item1155_ == address(0) || land721_ == address(0)) {
            revert ZeroAddress();
        }

        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURY_MANAGER_ROLE, admin);

        parameterRegistry = ParameterRegistry(parameterRegistry_);
        item1155 = Item1155(item1155_);
        land721 = Land721(land721_);
    }

    function buySeed(uint256 seedType, uint256 quantity) external payable whenNotPaused nonReentrant {
        if (quantity == 0) revert InvalidValue();

        bytes32 itemKey = _seedItemKey(seedType);
        uint256 unitPrice = _requireActivePrice(itemKey);
        uint256 totalCost = unitPrice * quantity;
        _collectPayment(totalCost);

        uint256 tokenId = _seedTokenId(seedType);
        item1155.mint(msg.sender, tokenId, quantity, "");
        emit ShopPurchase(msg.sender, itemKey, quantity, totalCost);
    }

    function buyTool(uint256 toolRarity, uint256 quantity) external payable whenNotPaused nonReentrant {
        if (quantity == 0) revert InvalidValue();

        bytes32 itemKey = _toolItemKey(toolRarity);
        uint256 unitPrice = _requireActivePrice(itemKey);
        uint256 totalCost = unitPrice * quantity;
        _collectPayment(totalCost);

        uint256 tokenId = _toolTokenId(toolRarity);
        item1155.mint(msg.sender, tokenId, quantity, "");
        emit ShopPurchase(msg.sender, itemKey, quantity, totalCost);
    }

    function buyWater(uint256 quantity) external payable whenNotPaused nonReentrant {
        if (quantity == 0) revert InvalidValue();

        bytes32 itemKey = _waterItemKey();
        uint256 unitPrice = _requireActivePrice(itemKey);
        uint256 totalCost = unitPrice * quantity;
        _collectPayment(totalCost);

        item1155.mint(msg.sender, _waterTokenId(), quantity, "");
        emit ShopPurchase(msg.sender, itemKey, quantity, totalCost);
    }

    function buyLand(uint256 quantity) external payable whenNotPaused nonReentrant {
        if (quantity == 0) revert InvalidValue();

        bytes32 itemKey = _landItemKey();
        uint256 unitPrice = _requireActivePrice(itemKey);
        uint256 totalCost = unitPrice * quantity;
        _collectPayment(totalCost);

        uint256[] memory tokenIds = land721.mintBatch(msg.sender, quantity);
        emit ShopPurchase(msg.sender, itemKey, tokenIds.length, totalCost);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function updateDependencies(address newParameterRegistry, address newItem1155, address newLand721)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newParameterRegistry == address(0) || newItem1155 == address(0) || newLand721 == address(0)) revert ZeroAddress();
        parameterRegistry = ParameterRegistry(newParameterRegistry);
        item1155 = Item1155(newItem1155);
        land721 = Land721(newLand721);
    }

    function _seedTokenId(uint256 seedType) internal pure returns (uint256) {
        return 200_000 + seedType;
    }

    function _toolTokenId(uint256 toolRarity) internal pure returns (uint256) {
        return 100_000 + toolRarity;
    }

    function _waterTokenId() internal pure returns (uint256) {
        return 300_000;
    }

    function _seedItemKey(uint256 seedType) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("SHOP_SEED", seedType));
    }

    function _toolItemKey(uint256 toolRarity) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("SHOP_TOOL", toolRarity));
    }

    function _waterItemKey() internal pure returns (bytes32) {
        return keccak256("SHOP_WATER");
    }

    function _landItemKey() internal pure returns (bytes32) {
        return keccak256("SHOP_LAND");
    }

    function _requireActivePrice(bytes32 itemKey) internal view returns (uint256) {
        ShopItemConfig memory config = parameterRegistry.getShopItemConfig(itemKey);
        if (!config.active) revert Unauthorized();
        return uint256(config.price);
    }

    function _collectPayment(uint256 expectedTotal) internal {
        if (msg.value != expectedTotal) revert InvalidValue();

        address treasury = parameterRegistry.treasury();
        if (treasury == address(0)) revert ZeroAddress();

        (bool success,) = payable(treasury).call{value: expectedTotal}("");
        if (!success) revert TransferFailed();
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    receive() external payable {
        revert Unauthorized();
    }

    fallback() external payable {
        revert Unauthorized();
    }
}
