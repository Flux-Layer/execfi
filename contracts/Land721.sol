// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {ERC721EnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import {ERC721PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";

import "./libs/Errors.sol";
import "./libs/Events.sol";

/**
 * @title Land721
 * @notice Upgradeable ERC-721 contract that represents Greenvale land plots.
 *         Supports role-gated minting, pausable transfers, and configurable base URI.
 */
contract Land721 is
    Initializable,
    ERC721EnumerableUpgradeable,
    ERC721PausableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant METADATA_ROLE = keccak256("METADATA_ROLE");

    uint256 public constant MAX_LAND_PER_USER = 4;
    uint256 private _nextTokenId;
    string private _baseTokenURI;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        string calldata name_,
        string calldata symbol_,
        string calldata baseTokenURI_
    ) external initializer {
        if (admin == address(0)) revert ZeroAddress();

        __ERC721_init(name_, symbol_);
        __ERC721Enumerable_init();
        __ERC721Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(METADATA_ROLE, admin);

        _baseTokenURI = baseTokenURI_;
        _nextTokenId = 1;
    }

    function mint(address to) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        if (to == address(0)) revert ZeroAddress();
        if (balanceOf(to) >= MAX_LAND_PER_USER) revert LandLimitReached(to);
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        emit LandMinted(to, tokenId);
    }

    function mintBatch(address to, uint256 quantity) external onlyRole(MINTER_ROLE) returns (uint256[] memory tokenIds) {
        if (to == address(0)) revert ZeroAddress();
        if (quantity == 0) revert InvalidValue();
        uint256 currentBalance = balanceOf(to);
        if (currentBalance + quantity > MAX_LAND_PER_USER) revert LandLimitReached(to);

        tokenIds = new uint256[](quantity);
        for (uint256 i; i < quantity; ++i) {
            uint256 tokenId = _nextTokenId++;
            tokenIds[i] = tokenId;
            _safeMint(to, tokenId);
            emit LandMinted(to, tokenId);
        }
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function setBaseURI(string calldata newBaseURI) external onlyRole(METADATA_ROLE) {
        _baseTokenURI = newBaseURI;
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721EnumerableUpgradeable, AccessControlUpgradeable, ERC721Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721EnumerableUpgradeable, ERC721PausableUpgradeable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 amount)
        internal
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
    {
        super._increaseBalance(account, amount);
    }
}
