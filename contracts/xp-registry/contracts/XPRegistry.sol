// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title XPRegistry
 * @notice Tracks provably signed XP emissions per user per game.
 * @dev Security hardening summary:
 *      - AccessControl handles privileged functions (DEFAULT_ADMIN_ROLE).
 *      - Pausable acts as a circuit breaker for suspicious activity.
 *      - ReentrancyGuard + checks-effects-interactions deter reentrancy.
 *      - EIP-712 signatures (chain-bound) with per-user/game nonces & deadline mitigate replay/front-running.
 *      - UUPS upgradeable: `_authorizeUpgrade` restricts upgrades to DEFAULT_ADMIN_ROLE.
 *      - Events expose complete audit trails for investigation.
 *      - Comments encourage static analysis (Slither, MythX/Certora) & fuzzing before production deploys.
 */
contract XPRegistry is
  Initializable,
  AccessControlUpgradeable,
  PausableUpgradeable,
  ReentrancyGuardUpgradeable,
  EIP712Upgradeable,
  UUPSUpgradeable
{
  using ECDSA for bytes32;

  struct Game {
    string name;
    address signer;
    bool isActive;
  }

  /// -----------------------------------------------------------------------
  /// Errors
  /// -----------------------------------------------------------------------
  error InvalidGameName();
  error SignerZeroAddress();
  error GameAlreadyRegistered(uint256 gameId);
  error GameNotRegistered(uint256 gameId);
  error GameNotActive(uint256 gameId);
  error InvalidAmount(uint256 amount);
  error DeadlineExpired(uint256 deadline);
  error AmountExceedsLimit(uint256 amount, uint256 limit);
  error InvalidSignature(address recovered, address expected);

  /// -----------------------------------------------------------------------
  /// Storage
  /// -----------------------------------------------------------------------
  mapping(address => mapping(uint256 => uint256)) public xp; // xp[user][gameId]
  mapping(address => uint256) public totalXP;
  mapping(address => mapping(uint256 => uint256)) public nonces; // nonces[user][gameId]
  mapping(uint256 => Game) public games;
  mapping(uint256 => uint256) public maxAmountPerTx; // optional per-game cap

  bytes32 public constant XP_ADD_TYPEHASH =
    keccak256("XPAdd(address user,uint256 gameId,uint256 amount,uint256 nonce,uint256 deadline)");

  /// -----------------------------------------------------------------------
  /// Events
  /// -----------------------------------------------------------------------
  event GameRegistered(uint256 indexed gameId, string name, address indexed signer, bool active);
  event GameSignerUpdated(uint256 indexed gameId, address indexed previousSigner, address indexed newSigner);
  event GameActiveUpdated(uint256 indexed gameId, bool active);
  event GameRateLimitUpdated(uint256 indexed gameId, uint256 maxAmount);
  event XPIncreased(
    address indexed user,
    uint256 indexed gameId,
    uint256 amount,
    uint256 nonce,
    uint256 newGameXP,
    uint256 newTotalXP
  );
  event NonceUsed(address indexed user, uint256 indexed gameId, uint256 nonce);
  event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

  /// -----------------------------------------------------------------------
  /// Initializer
  /// -----------------------------------------------------------------------

  /**
   * @notice Initializes the registry with an admin who holds DEFAULT_ADMIN_ROLE.
   * @dev Uses initializer modifier to prevent re-execution after proxy deployment.
   */
  function initialize(address admin) public initializer {
    if (admin == address(0)) revert SignerZeroAddress();

    __AccessControl_init();
    __Pausable_init();
    __ReentrancyGuard_init();
    __EIP712_init("XPRegistry", "1");
    __UUPSUpgradeable_init();

    _grantRole(DEFAULT_ADMIN_ROLE, admin);
  }

  /// -----------------------------------------------------------------------
  /// Admin controls (DEFAULT_ADMIN_ROLE)
  /// -----------------------------------------------------------------------

  function registerGame(uint256 gameId, string calldata name, address signer)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
  {
    if (bytes(name).length == 0) revert InvalidGameName();
    if (signer == address(0)) revert SignerZeroAddress();
    if (bytes(games[gameId].name).length != 0) revert GameAlreadyRegistered(gameId);

    games[gameId] = Game({name: name, signer: signer, isActive: true});
    emit GameRegistered(gameId, name, signer, true);
  }

  function setGameSigner(uint256 gameId, address newSigner) external onlyRole(DEFAULT_ADMIN_ROLE) {
    if (newSigner == address(0)) revert SignerZeroAddress();
    Game storage game = _getGame(gameId);
    address previous = game.signer;
    game.signer = newSigner;
    emit GameSignerUpdated(gameId, previous, newSigner);
  }

  /**
   * @notice Disaster recovery: rotate signer while paused to avoid confused deputies.
   * @dev Pause first, update signer, then unpause after out-of-band review.
   */
  function emergencySetGameSigner(uint256 gameId, address newSigner)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
    whenPaused
  {
    if (newSigner == address(0)) revert SignerZeroAddress();
    Game storage game = _getGame(gameId);
    address previous = game.signer;
    game.signer = newSigner;
    emit GameSignerUpdated(gameId, previous, newSigner);
  }

  function setGameActive(uint256 gameId, bool active) external onlyRole(DEFAULT_ADMIN_ROLE) {
    Game storage game = _getGame(gameId);
    game.isActive = active;
    emit GameActiveUpdated(gameId, active);
  }

  /**
   * @notice Optional anti-flood measure per game. 0 disables the cap.
   */
  function setGameRateLimit(uint256 gameId, uint256 maxAmountPerTx_) external onlyRole(DEFAULT_ADMIN_ROLE) {
    _getGame(gameId);
    maxAmountPerTx[gameId] = maxAmountPerTx_;
    emit GameRateLimitUpdated(gameId, maxAmountPerTx_);
  }

  function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
    // Pausable emits Paused(sender)
  }

  function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
    // Pausable emits Unpaused(sender)
  }

  /**
   * @notice Transfer DEFAULT_ADMIN_ROLE (emit event for audit trail). Use multisig/timelock off-chain if possible.
   */
  function transferAdmin(address newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
    if (newAdmin == address(0)) revert SignerZeroAddress();
    address previousAdmin = _msgSender();
    _grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
    _revokeRole(DEFAULT_ADMIN_ROLE, previousAdmin);
    emit AdminTransferred(previousAdmin, newAdmin);
  }

  /// -----------------------------------------------------------------------
  /// XP issuance (signature flow)
  /// -----------------------------------------------------------------------

  /**
   * @dev Security controls:
   *      - whenNotPaused: circuit breaker if abuse is detected.
   *      - nonReentrant: future-proof against accidental external calls.
   *      - Nonce consumed before state mutation to block replay even on revert.
   *      - Deadline prevents long-lived signed orders being sandwiched or replayed after risk windows.
   */
  function addXPWithSig(
    address user,
    uint256 gameId,
    uint256 amount,
    uint256 deadline,
    bytes calldata signature
  ) external whenNotPaused nonReentrant {
    _addXPWithSig(user, gameId, amount, deadline, signature);
  }

  /**
   * @dev Backwards-compatible alias for callers using camelCase selector.
   */
  function addXpWithSig(
    address user,
    uint256 gameId,
    uint256 amount,
    uint256 deadline,
    bytes calldata signature
  ) external whenNotPaused nonReentrant {
    _addXPWithSig(user, gameId, amount, deadline, signature);
  }

  function _addXPWithSig(
    address user,
    uint256 gameId,
    uint256 amount,
    uint256 deadline,
    bytes calldata signature
  ) internal {
    if (user == address(0)) revert InvalidSignature(address(0), address(0));
    if (amount == 0) revert InvalidAmount(amount);
    if (deadline < block.timestamp) revert DeadlineExpired(deadline);

    Game storage game = _getGame(gameId);
    if (!game.isActive) revert GameNotActive(gameId);
    address signer = game.signer;
    if (signer == address(0)) revert SignerZeroAddress();

    uint256 expectedNonce = nonces[user][gameId];

    bytes32 digest = _hashTypedDataV4(
      keccak256(abi.encode(XP_ADD_TYPEHASH, user, gameId, amount, expectedNonce, deadline))
    );

    address recovered = digest.recover(signature);
    if (recovered != signer) revert InvalidSignature(recovered, signer);

    uint256 limit = maxAmountPerTx[gameId];
    if (limit != 0 && amount > limit) revert AmountExceedsLimit(amount, limit);

    // Checks complete — Effects
    unchecked {
      nonces[user][gameId] = expectedNonce + 1;
    }
    emit NonceUsed(user, gameId, expectedNonce);

    uint256 newGameXP = xp[user][gameId] + amount;
    uint256 newTotalXP = totalXP[user] + amount;

    xp[user][gameId] = newGameXP;
    totalXP[user] = newTotalXP;

    emit XPIncreased(user, gameId, amount, expectedNonce, newGameXP, newTotalXP);
    // No external interactions => CEI satisfied; ReentrancyGuardUpgradeable protects future extensibility.
  }

  /// -----------------------------------------------------------------------
  /// View helpers
  /// -----------------------------------------------------------------------

  function domainSeparator() external view returns (bytes32) {
    return _domainSeparatorV4();
  }

  function getNonce(address account, uint256 gameId) external view returns (uint256) {
    return nonces[account][gameId];
  }

  function hashXPAddStruct(address user, uint256 gameId, uint256 amount, uint256 nonce, uint256 deadline)
    public
    pure
    returns (bytes32)
  {
    return keccak256(abi.encode(XP_ADD_TYPEHASH, user, gameId, amount, nonce, deadline));
  }

  function getDigest(address user, uint256 gameId, uint256 amount, uint256 nonce, uint256 deadline)
    external
    view
    returns (bytes32)
  {
    return _hashTypedDataV4(hashXPAddStruct(user, gameId, amount, nonce, deadline));
  }

  /// -----------------------------------------------------------------------
  /// Upgrade authorization
  /// -----------------------------------------------------------------------

  function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

  /// -----------------------------------------------------------------------
  /// Internal utilities
  /// -----------------------------------------------------------------------

  function _getGame(uint256 gameId) internal view returns (Game storage game) {
    game = games[gameId];
    if (bytes(game.name).length == 0) revert GameNotRegistered(gameId);
  }

  function supportsInterface(bytes4 interfaceId)
    public
    view
    override(AccessControlUpgradeable)
    returns (bool)
  {
    return super.supportsInterface(interfaceId);
  }

  /// Reserve storage slots for future upgrades.
  uint256[45] private __gap;

  /// Developer guidance: run Slither, MythX/Certora, and forge fuzzing before production deployment.
}
