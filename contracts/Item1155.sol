// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {ERC1155SupplyUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./libs/Errors.sol";

/**
 * @title Item1155
 * @notice Upgradeable ERC-1155 contract that holds Greenvale assets (seed, water, tools).
 *         Minting and burning are protected by roles delegated to the game modules.
 */
contract Item1155 is
    Initializable,
    ERC1155Upgradeable,
    ERC1155SupplyUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant URI_MANAGER_ROLE = keccak256("URI_MANAGER_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, string calldata baseUri) external initializer {
        if (admin == address(0)) revert ZeroAddress();

        __ERC1155_init(baseUri);
        __ERC1155Supply_init();
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);
        _grantRole(URI_MANAGER_ROLE, admin);
    }

    function mint(address to, uint256 id, uint256 amount, bytes calldata data) external onlyRole(MINTER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidValue();
        _mint(to, id, amount, data);
    }

    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data)
        external
        onlyRole(MINTER_ROLE)
    {
        if (to == address(0)) revert ZeroAddress();
        if (ids.length != amounts.length) revert LengthMismatch();

        uint256 length = amounts.length;
        if (length == 0) revert InvalidValue();
        for (uint256 i; i < length; ++i) {
            if (amounts[i] == 0) revert InvalidValue();
        }

        _mintBatch(to, ids, amounts, data);
    }

    function burn(address from, uint256 id, uint256 amount) external onlyRole(BURNER_ROLE) {
        if (from == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidValue();
        _burn(from, id, amount);
    }

    function burnBatch(address from, uint256[] calldata ids, uint256[] calldata amounts)
        external
        onlyRole(BURNER_ROLE)
    {
        if (from == address(0)) revert ZeroAddress();
        if (ids.length != amounts.length) revert LengthMismatch();

        uint256 length = amounts.length;
        if (length == 0) revert InvalidValue();
        for (uint256 i; i < length; ++i) {
            if (amounts[i] == 0) revert InvalidValue();
        }

        _burnBatch(from, ids, amounts);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function setURI(string calldata newUri) external onlyRole(URI_MANAGER_ROLE) {
        _setURI(newUri);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    ) internal override(ERC1155Upgradeable, ERC1155SupplyUpgradeable) whenNotPaused {
        super._update(from, to, ids, amounts);
    }

    uint256[45] private __gap;
}
