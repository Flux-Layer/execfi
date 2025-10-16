// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IDegenshoot} from "../interfaces/IDegenshoot.sol";

contract WagerVault is AccessControl, ReentrancyGuard {
    error InvalidAmount();
    error InvalidTreasury();
    error InvalidFee();
    error SessionNotVerified();
    error AlreadySettled();
    error NoEscrow();
    error BetAlreadyPlaced();
    error InvalidRecipient();
    error SessionConsumed();

    event BetPlaced(address indexed bettor, bytes32 indexed sessionKey, uint256 amount);
    event Settled(
        address indexed user,
        uint64 indexed sessionId,
        uint256 indexed gameId,
        uint256 stake,
        uint256 gross,
        uint256 fee,
        uint256 net
    );
    event Withdrawn(address indexed user, uint256 amount);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event FeeUpdated(uint16 previousFeeBps, uint16 newFeeBps);
    event EscrowRefunded(bytes32 indexed sessionKey, address indexed recipient, uint256 amount);

    address public immutable degenshoot;
    uint256 public immutable gameId;

    address public treasury;
    uint16 public houseFeeBps;

    mapping(bytes32 => uint256) public escrow;
    mapping(address => uint256) public balances;
    mapping(bytes32 => bool) public settled;

    constructor(
        address admin,
        address degenshootContract,
        address treasuryAddress,
        uint16 feeBps
    ) {
        if (admin == address(0) || degenshootContract == address(0) || treasuryAddress == address(0)) {
            revert InvalidTreasury();
        }
        if (feeBps > 10_000) revert InvalidFee();

        degenshoot = degenshootContract;
        treasury = treasuryAddress;
        houseFeeBps = feeBps;
        gameId = IDegenshoot(degenshootContract).gameId();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (admin != msg.sender) {
            _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        }
    }

    modifier onlyDegenshoot() {
        require(msg.sender == degenshoot, "WagerVault: not degenshoot");
        _;
    }

    receive() external payable {}

    function placeBet(uint64 sessionId) external payable {
        if (msg.value == 0) revert InvalidAmount();
        bytes32 sessionKey = IDegenshoot(degenshoot).sessionKey(msg.sender, gameId, sessionId);
        if (settled[sessionKey]) revert AlreadySettled();
        if (IDegenshoot(degenshoot).sessionUsed(sessionKey)) revert SessionConsumed();
        if (escrow[sessionKey] != 0) revert BetAlreadyPlaced();
        escrow[sessionKey] = msg.value;
        emit BetPlaced(msg.sender, sessionKey, msg.value);
    }

    function settle(
        address user,
        uint64 sessionId,
        uint256 submittedGameId,
        uint256 multiplierX100
    ) external onlyDegenshoot nonReentrant {
        if (submittedGameId != gameId) revert SessionNotVerified();
        if (multiplierX100 == 0) revert InvalidAmount();
        bytes32 key = IDegenshoot(degenshoot).sessionKey(user, submittedGameId, sessionId);
        if (!IDegenshoot(degenshoot).sessionUsed(key)) revert SessionNotVerified();
        if (settled[key]) revert AlreadySettled();

        uint256 stake = escrow[key];
        if (stake == 0) revert NoEscrow();
        settled[key] = true;
        escrow[key] = 0;

        uint256 gross = stake * multiplierX100 / 100;
        uint256 fee = (gross * houseFeeBps) / 10_000;
        uint256 net = gross - fee;

        balances[user] += net;
        if (fee > 0) {
            balances[treasury] += fee;
        }
        if (gross < stake) {
            balances[treasury] += stake - gross;
        }

        emit Settled(user, sessionId, submittedGameId, stake, gross, fee, net);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0 || amount > balances[msg.sender]) revert InvalidAmount();
        balances[msg.sender] -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "WagerVault: withdraw failed");
        emit Withdrawn(msg.sender, amount);
    }

    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert InvalidTreasury();
        address previous = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(previous, newTreasury);
    }

    function setHouseFeeBps(uint16 newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newFeeBps > 10_000) revert InvalidFee();
        uint16 previous = houseFeeBps;
        houseFeeBps = newFeeBps;
        emit FeeUpdated(previous, newFeeBps);
    }

    function adminRefundEscrow(bytes32 sessionKey, address recipient) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (recipient == address(0)) revert InvalidRecipient();
        uint256 amount = escrow[sessionKey];
        if (amount == 0) revert NoEscrow();
        escrow[sessionKey] = 0;
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "WagerVault: refund failed");
        emit EscrowRefunded(sessionKey, recipient, amount);
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
