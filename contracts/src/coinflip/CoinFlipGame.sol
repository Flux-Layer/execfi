// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IXPRegistry} from "../shared/IXPRegistry.sol";
import {ICoinFlipVault} from "./interfaces/ICoinFlipVault.sol";

/**
 * @title CoinFlipGame
 * @notice Verifies signer-supplied coin flip outcomes and settles payouts via the linked vault.
 * @dev Modeled after the Degenshoot contract with coin-specific fields (guess/outcome).
 */
contract CoinFlipGame is AccessControl, Pausable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    /**
     * @notice Envelope signed by the game signer to authorise payouts and XP distribution.
     * @dev `guess` and `outcome` use 0 = Heads, 1 = Tails.
     */
    struct Result {
        address user;
        uint256 gameId;
        uint64 sessionId;
        uint8 guess; // 0 = Heads, 1 = Tails
        uint8 outcome; // 0 = Heads, 1 = Tails
        uint256 wager;
        uint256 multiplierX100;
        uint256 xp;
        uint256 deadline;
    }

    bytes32 public constant RESULT_TYPEHASH = keccak256(
        "Result(address user,uint256 gameId,uint64 sessionId,uint8 guess,uint8 outcome,uint256 wager,uint256 multiplierX100,uint256 xp,uint256 deadline)"
    );

    /// @notice Thrown when result input data is invalid.
    error InvalidResult();
    /// @notice Thrown when a signature cannot be verified against the active game signer.
    error InvalidSignature();
    /// @notice Thrown when the supplied deadlines have already passed.
    error ResultExpired();
    /// @notice Thrown when a session key has already been processed.
    error SessionAlreadyConsumed();
    /// @notice Thrown when the vault address is missing or mismatched.
    error InvalidVault();

    /// @notice Emitted when the game signer address changes.
    event GameSignerUpdated(address indexed previousSigner, address indexed newSigner);
    /// @notice Emitted when a result is accepted and will trigger settlement + XP award.
    event ResultAccepted(address indexed user, uint64 indexed sessionId, uint8 outcome, uint256 xp);
    /// @notice Emitted when a session key is permanently marked as used.
    event SessionConsumed(bytes32 indexed key);
    /// @notice Emitted when the vault pointer is changed by an admin.
    event VaultUpdated(address indexed previousVault, address indexed newVault);

    IXPRegistry public immutable REGISTRY;
    uint256 public immutable GAME_ID;

    address public gameSigner;
    ICoinFlipVault public vault;
    mapping(bytes32 => bool) public sessionUsed;

    /**
     * @param admin Address granted DEFAULT_ADMIN_ROLE.
     * @param initialGameSigner Address used to sign Result payloads.
     * @param registryProxy XP registry proxy contract.
     * @param gameId_ Unique game identifier used across vault + registry.
     */
    constructor(
        address admin,
        address initialGameSigner,
        address registryProxy,
        uint256 gameId_
    ) EIP712("CoinFlipGame", "1") {
        if (admin == address(0) || initialGameSigner == address(0) || registryProxy == address(0)) {
            revert InvalidResult();
        }

        REGISTRY = IXPRegistry(registryProxy);
        GAME_ID = gameId_;
        gameSigner = initialGameSigner;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (admin != msg.sender) {
            _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        }
    }

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert InvalidResult();
        _;
    }

    /**
     * @notice Update the EIP-712 signer used to validate game results.
     * @param newSigner Address of the replacement signer.
     */
    function setGameSigner(address newSigner) external onlyAdmin {
        if (newSigner == address(0)) revert InvalidResult();
        address previous = gameSigner;
        gameSigner = newSigner;
        emit GameSignerUpdated(previous, newSigner);
    }

    /**
     * @notice Update the payout vault reference.
     * @param newVault Address of the new vault contract.
     */
    function setVault(address newVault) external onlyAdmin {
        if (newVault == address(0)) revert InvalidVault();
        if (ICoinFlipVault(newVault).gameId() != GAME_ID) revert InvalidVault();
        address previous = address(vault);
        vault = ICoinFlipVault(newVault);
        emit VaultUpdated(previous, newVault);
    }

    /// @notice Pause result submissions.
    function pause() external onlyAdmin {
        _pause();
    }

    /// @notice Unpause result submissions.
    function unpause() external onlyAdmin {
        _unpause();
    }

    /**
     * @notice Submit a signed result from the game signer and claim XP on behalf of the player.
     * @param result The full result payload.
     * @param resultSignature EIP-712 signature from the game signer.
     * @param xpDeadline Deadline used by the XP registry signature.
     * @param xpSignature Signature authorising XP accrual.
     */
    function submitResultAndClaimXP(
        Result calldata result,
        bytes calldata resultSignature,
        uint256 xpDeadline,
        bytes calldata xpSignature
    ) external whenNotPaused nonReentrant {
        if (
            result.user == address(0) ||
            result.gameId != GAME_ID ||
            result.xp == 0 ||
            (result.outcome > 1 || result.guess > 1)
        ) {
            revert InvalidResult();
        }
        if (block.timestamp > result.deadline || block.timestamp > xpDeadline) {
            revert ResultExpired();
        }

        bytes32 key = sessionKey(result.user, result.gameId, result.sessionId);
        if (sessionUsed[key]) revert SessionAlreadyConsumed();

        bytes32 digest = _hashResult(result);
        address recovered = digest.recover(resultSignature);
        if (recovered != gameSigner) revert InvalidSignature();

        sessionUsed[key] = true;
        emit SessionConsumed(key);
        emit ResultAccepted(result.user, result.sessionId, result.outcome, result.xp);

        ICoinFlipVault targetVault = vault;
        if (address(targetVault) == address(0)) revert InvalidVault();
        targetVault.settle(
            result.user,
            result.sessionId,
            result.gameId,
            result.multiplierX100,
            result.outcome,
            result.guess
        );

        REGISTRY.addXpWithSig(result.user, result.gameId, result.xp, xpDeadline, xpSignature);
    }

    /**
     * @notice Derive the session key used for replay protection and escrow lookup.
     * @param user Player address.
     * @param gameId_ Game identifier.
     * @param sessionId Sequential session id.
     */
    function sessionKey(address user, uint256 gameId_, uint64 sessionId) public pure returns (bytes32) {
        return keccak256(abi.encode(user, gameId_, sessionId));
    }

    /// @notice Return the immutable game id.
    function gameId() external view returns (uint256) {
        return GAME_ID;
    }

    /// @notice Expose the typed data hash for off-chain verification/testing.
    function hashResult(Result calldata result) external view returns (bytes32) {
        return _hashResult(result);
    }

    /// @notice Return the EIP-712 domain separator.
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _hashResult(Result calldata result) internal view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    RESULT_TYPEHASH,
                    result.user,
                    result.gameId,
                    result.sessionId,
                    result.guess,
                    result.outcome,
                    result.wager,
                    result.multiplierX100,
                    result.xp,
                    result.deadline
                )
            )
        );
    }
}
