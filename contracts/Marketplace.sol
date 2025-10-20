// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ERC1155HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import {ERC721HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./libs/Errors.sol";
import "./libs/Events.sol";
import "./libs/Structs.sol";
import "./ParameterRegistry.sol";
import "./Item1155.sol";
import "./Land721.sol";

/**
 * @title Marketplace
 * @notice Minimal peer-to-peer marketplace supporting ERC-1155 batch listings and ERC-721 single listings.
 *         Uses ParameterRegistry for treasury and fee configuration.
 */
contract Marketplace is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC1155HolderUpgradeable,
    ERC721HolderUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    ParameterRegistry public parameterRegistry;
    Item1155 public item1155;
    Land721 public land721;

    uint256 private _listingCounter;
    mapping(uint256 => MarketplaceListing) private _listings;

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
        __ERC1155Holder_init();
        __ERC721Holder_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);

        parameterRegistry = ParameterRegistry(parameterRegistry_);
        item1155 = Item1155(item1155_);
        land721 = Land721(land721_);
    }

    function list1155(uint256 tokenId, uint64 amount, uint128 pricePerUnit, uint64 expiry)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 listingId)
    {
        if (amount == 0 || pricePerUnit == 0) revert InvalidValue();

        item1155.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");

        listingId = _createListing(msg.sender, address(item1155), tokenId, amount, pricePerUnit, true, expiry);
    }

    function list721(uint256 tokenId, uint128 price, uint64 expiry)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 listingId)
    {
        if (price == 0) revert InvalidValue();
        if (land721.ownerOf(tokenId) != msg.sender) revert Unauthorized();

        land721.safeTransferFrom(msg.sender, address(this), tokenId);

        listingId = _createListing(msg.sender, address(land721), tokenId, 1, price, false, expiry);
    }

    function buy1155(uint256 listingId, uint64 quantity) external payable whenNotPaused nonReentrant {
        if (quantity == 0) revert InvalidValue();
        MarketplaceListing storage listing = _listings[listingId];
        if (!listing.is1155 || listing.seller == address(0)) revert Unauthorized();
        if (listing.expiry != 0 && block.timestamp > listing.expiry) revert SignatureExpired(listing.expiry);
        if (quantity > listing.amount) revert InvalidValue();

        uint256 totalCost = uint256(listing.pricePerUnit) * quantity;
        _settlePayment(listing.seller, totalCost);

        listing.amount -= quantity;
        item1155.safeTransferFrom(address(this), msg.sender, listing.tokenId, quantity, "");

        emit MarketplacePurchase({
            listingId: bytes32(listingId),
            buyer: msg.sender,
            amountFilled: quantity,
            totalPaid: totalCost,
            feeRecipient: parameterRegistry.treasury(),
            feeAmount: _calculateFee(totalCost)
        });

        if (listing.amount == 0) {
            delete _listings[listingId];
        }
    }

    function buy721(uint256 listingId) external payable whenNotPaused nonReentrant {
        MarketplaceListing storage listing = _listings[listingId];
        if (listing.is1155 || listing.seller == address(0)) revert Unauthorized();
        if (listing.expiry != 0 && block.timestamp > listing.expiry) revert SignatureExpired(listing.expiry);

        uint256 totalCost = uint256(listing.pricePerUnit);
        address seller = listing.seller;
        uint256 tokenId = listing.tokenId;
        address feeRecipient = parameterRegistry.treasury();
        uint256 feeAmount = _calculateFee(totalCost);

        _settlePayment(seller, totalCost);

        delete _listings[listingId];
        land721.safeTransferFrom(address(this), msg.sender, tokenId);

        emit MarketplacePurchase({
            listingId: bytes32(listingId),
            buyer: msg.sender,
            amountFilled: 1,
            totalPaid: totalCost,
            feeRecipient: feeRecipient,
            feeAmount: feeAmount
        });
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        MarketplaceListing storage listing = _listings[listingId];
        if (listing.seller == address(0)) revert Unauthorized();
        if (listing.seller != msg.sender && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert Unauthorized();

        address seller = listing.seller;
        uint256 tokenId = listing.tokenId;
        uint64 amount = listing.amount;
        bool is1155 = listing.is1155;

        delete _listings[listingId];

        if (is1155) {
            item1155.safeTransferFrom(address(this), seller, tokenId, amount, "");
        } else {
            land721.safeTransferFrom(address(this), seller, tokenId);
        }

        emit MarketplaceListingCancelled(bytes32(listingId), seller);
    }

    function getListing(uint256 listingId) external view returns (MarketplaceListing memory) {
        return _listings[listingId];
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

    function _createListing(
        address seller,
        address asset,
        uint256 tokenId,
        uint64 amount,
        uint128 pricePerUnit,
        bool is1155,
        uint64 expiry
    ) internal returns (uint256 listingId) {
        listingId = ++_listingCounter;

        MarketplaceListing storage listing = _listings[listingId];
        listing.seller = seller;
        listing.asset = asset;
        listing.tokenId = tokenId;
        listing.pricePerUnit = pricePerUnit;
        listing.amount = amount;
        listing.expiry = expiry;
        listing.is1155 = is1155;

        emit MarketplaceListingCreated(
            bytes32(listingId),
            seller,
            asset,
            tokenId,
            amount,
            pricePerUnit,
            address(0),
            expiry
        );
    }

    function _settlePayment(address seller, uint256 totalCost) internal {
        if (msg.value != totalCost) revert InvalidValue();

        address treasury = parameterRegistry.treasury();
        if (treasury == address(0)) revert ZeroAddress();

        uint256 fee = _calculateFee(totalCost);
        uint256 payout = totalCost - fee;

        if (fee > 0) {
            (bool feeSuccess,) = payable(treasury).call{value: fee}("");
            if (!feeSuccess) revert TransferFailed();
        }

        (bool sellerSuccess,) = payable(seller).call{value: payout}("");
        if (!sellerSuccess) revert TransferFailed();
    }

    function _calculateFee(uint256 amount) internal view returns (uint256) {
        uint16 feeBps = parameterRegistry.marketFeeBps();
        if (feeBps == 0) return 0;
        return (amount * feeBps) / 10_000;
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControlUpgradeable, ERC1155HolderUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    receive() external payable {
        revert Unauthorized();
    }

    fallback() external payable {
        revert Unauthorized();
    }
}
