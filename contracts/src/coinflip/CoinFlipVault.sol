// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICoinFlip} from "./interfaces/ICoinFlip.sol";

/**
 * @title CoinFlipVault
 * @notice Escrows coin flip wagers and settles payouts once CoinFlipGame validates results.
 * @dev Mirrors the Degenshoot WagerVault behaviour with coin-specific metadata.
 */
contract CoinFlipVault is AccessControl, ReentrancyGuard {
    /// @notice Thrown when zero amount operations are attempted.
    error InvalidAmount();
    /// @notice Thrown when treasury configuration is invalid.
    error InvalidTreasury();
    /// @notice Thrown when fee basis points exceed 10000.
    error InvalidFee();
    /// @notice Thrown when the supplied session cannot be verified against the game contract.
    error SessionNotVerified();
    /// @notice Thrown when a session has already been settled.
    error AlreadySettled();
    /// @notice Thrown when no escrow exists for a session key.
    error NoEscrow();
    /// @notice Thrown when the bettor already placed a stake for the session.
    error BetAlreadyPlaced();
    /// @notice Thrown when an invalid payout recipient is provided.
    error InvalidRecipient();
    /// @notice Thrown when a session was already consumed in the game contract.
    error SessionConsumed();

    /// @notice Emitted when a player stakes ETH for a session.
    event BetPlaced(address indexed bettor, bytes32 indexed sessionKey, uint256 amount);
    /// @notice Emitted when a session settles and funds are distributed.
    event Settled(
        address indexed user,
        uint64 indexed sessionId,
        uint256 indexed gameId,
        uint256 stake,
        uint256 gross,
        uint256 fee,
        uint256 net,
        uint8 outcome,
        uint8 guess
    );
    /// @notice Emitted when a user withdraws their accumulated balance.
    event Withdrawn(address indexed user, uint256 amount);
    /// @notice Emitted when the treasury address changes.
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    /// @notice Emitted when the house fee basis points change.
    event FeeUpdated(uint16 previousFeeBps, uint16 newFeeBps);
    /// @notice Emitted when an administrator refunds escrow to a recipient.
    event EscrowRefunded(bytes32 indexed sessionKey, address indexed recipient, uint256 amount);
    /// @notice Emitted when the admin sweeps the remaining balance.
    event EmergencyWithdrawal(address indexed recipient, uint256 amount);

    address public immutable coinFlip;
    uint256 public immutable gameId;

    address public treasury;
    uint16 public houseFeeBps;

    mapping(bytes32 => uint256) public escrow;
    mapping(address => uint256) public balances;
    mapping(bytes32 => bool) public settled;

    /**
     * @param admin Address granted DEFAULT_ADMIN_ROLE.
     * @param coinFlipContract CoinFlipGame contract address.
     * @param treasuryAddress Recipient address for house fees.
     * @param feeBps House fee in basis points (max 10000).
     */
    constructor(
        address admin,
        address coinFlipContract,
        address treasuryAddress,
        uint16 feeBps
    ) {
        if (admin == address(0) || coinFlipContract == address(0) || treasuryAddress == address(0)) {
            revert InvalidTreasury();
        }
        if (feeBps > 10_000) revert InvalidFee();

        coinFlip = coinFlipContract;
        treasury = treasuryAddress;
        houseFeeBps = feeBps;
        gameId = ICoinFlip(coinFlipContract).gameId();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (admin != msg.sender) {
            _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        }
    }

    modifier onlyCoinFlip() {
        require(msg.sender == coinFlip, "CoinFlipVault: not game contract");
        _;
    }

    receive() external payable {}

    /**
     * @notice Stake ETH for a specific coin flip session.
     * @param sessionId Session identifier generated off-chain.
     */
    function placeBet(uint64 sessionId) external payable {
        if (msg.value == 0) revert InvalidAmount();
        bytes32 sessionKey = ICoinFlip(coinFlip).sessionKey(msg.sender, gameId, sessionId);
        if (settled[sessionKey]) revert AlreadySettled();
        if (ICoinFlip(coinFlip).sessionUsed(sessionKey)) revert SessionConsumed();
        if (escrow[sessionKey] != 0) revert BetAlreadyPlaced();
        escrow[sessionKey] = msg.value;
        emit BetPlaced(msg.sender, sessionKey, msg.value);
    }

    /**
     * @notice Settle a session after the game contract validates the signed result.
     * @dev callable only by the CoinFlipGame contract.
     */
    function settle(
        address user,
        uint64 sessionId,
        uint256 submittedGameId,
        uint256 multiplierX100,
        uint8 outcome,
        uint8 guess
    ) external onlyCoinFlip nonReentrant {
        if (submittedGameId != gameId) revert SessionNotVerified();
        bytes32 key = ICoinFlip(coinFlip).sessionKey(user, submittedGameId, sessionId);
        if (!ICoinFlip(coinFlip).sessionUsed(key)) revert SessionNotVerified();
        if (settled[key]) revert AlreadySettled();

        uint256 stake = escrow[key];
        if (stake == 0) revert NoEscrow();
        settled[key] = true;
        escrow[key] = 0;

        uint256 gross = (stake * multiplierX100) / 100;
        uint256 fee = (gross * houseFeeBps) / 10_000;
        uint256 net = gross >= fee ? gross - fee : 0;

        if (net > 0) {
            balances[user] += net;
        }
        if (fee > 0) {
            balances[treasury] += fee;
        }
        if (gross < stake) {
            balances[treasury] += stake - gross;
        }

        emit Settled(user, sessionId, submittedGameId, stake, gross, fee, net, outcome, guess);
    }

    /**
     * @notice Withdraw accumulated balances.
     * @param amount Amount in wei to withdraw.
     */
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0 || amount > balances[msg.sender]) revert InvalidAmount();
        balances[msg.sender] -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "CoinFlipVault: withdraw failed");
        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Update the treasury address used for collecting house fees.
     * @param newTreasury Treasury address.
     */
    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert InvalidTreasury();
        address previous = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(previous, newTreasury);
    }

    /**
     * @notice Update house fee basis points (max 100%).
     * @param newFeeBps Fee expressed in basis points.
     */
    function setHouseFeeBps(uint16 newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newFeeBps > 10_000) revert InvalidFee();
        uint16 previous = houseFeeBps;
        houseFeeBps = newFeeBps;
        emit FeeUpdated(previous, newFeeBps);
    }

    /**
     * @notice Admin path to refund escrow when a session needs manual intervention.
     * @param sessionKey Session key derived from user/game/sessionId.
     * @param recipient Recipient receiving the refund.
     */
    function adminRefundEscrow(bytes32 sessionKey, address recipient) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (recipient == address(0)) revert InvalidRecipient();
        uint256 amount = escrow[sessionKey];
        if (amount == 0) revert NoEscrow();
        escrow[sessionKey] = 0;
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "CoinFlipVault: refund failed");
        emit EscrowRefunded(sessionKey, recipient, amount);
    }

    /**
     * @notice Sweep the remaining contract balance to a recipient wallet.
     * @dev Intended for sunsetting the game; bypasses user balances so use with care.
     */
    function emergencyWithdraw(address recipient) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (recipient == address(0)) revert InvalidRecipient();
        uint256 amount = address(this).balance;
        require(amount > 0, "CoinFlipVault: no funds");
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "CoinFlipVault: emergency withdraw failed");
        emit EmergencyWithdrawal(recipient, amount);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
