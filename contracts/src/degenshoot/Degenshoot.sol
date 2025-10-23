// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IXPRegistry} from "../shared/IXPRegistry.sol";
import {IWagerVault} from "./interfaces/IWagerVault.sol";

contract Degenshoot is AccessControl, Pausable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    struct Result {
        address user;
        uint256 gameId;
        uint64 sessionId;
        uint32 score;
        uint32 kills;
        uint32 timeAlive;
        uint256 wager;
        uint256 multiplierX100;
        uint256 xp;
        uint256 deadline;
    }

    bytes32 public constant RESULT_TYPEHASH = keccak256(
        "Result(address user,uint256 gameId,uint64 sessionId,uint32 score,uint32 kills,uint32 timeAlive,uint256 wager,uint256 multiplierX100,uint256 xp,uint256 deadline)"
    );

    error InvalidResult();
    error InvalidResultSignature();
    error ResultExpired();
    error SessionAlreadyConsumed();
    error InvalidVault();

    event GameSignerUpdated(address indexed previousSigner, address indexed newSigner);
    event ResultAccepted(address indexed user, uint64 indexed sessionId, uint256 xp, uint256 indexed gameId);
    event SessionConsumed(bytes32 indexed key);
    event WagerVaultUpdated(address indexed previousVault, address indexed newVault);

    IXPRegistry public immutable REGISTRY;
    uint256 public immutable GAME_ID;

    address public gameSigner;
    IWagerVault public wagerVault;
    mapping(bytes32 => bool) public sessionUsed;

    constructor(
        address admin,
        address initialGameSigner,
        address registryProxy,
        uint256 gameId_
    ) EIP712("Degenshoot", "1") {
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

    function setGameSigner(address newSigner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newSigner == address(0)) revert InvalidResult();
        address previous = gameSigner;
        gameSigner = newSigner;
        emit GameSignerUpdated(previous, newSigner);
    }

    function setWagerVault(address newVault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newVault == address(0)) revert InvalidVault();
        if (IWagerVault(newVault).gameId() != GAME_ID) revert InvalidVault();
        address previous = address(wagerVault);
        wagerVault = IWagerVault(newVault);
        emit WagerVaultUpdated(previous, newVault);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function submitResultAndClaimXP(
        Result calldata result,
        bytes calldata resultSignature,
        uint256 xpDeadline,
        bytes calldata xpSignature
    ) external whenNotPaused nonReentrant {
        if (result.user == address(0) || result.gameId != GAME_ID || result.xp == 0) {
            revert InvalidResult();
        }
        if (block.timestamp > result.deadline || block.timestamp > xpDeadline) {
            revert ResultExpired();
        }

        bytes32 key = sessionKey(result.user, result.gameId, result.sessionId);
        if (sessionUsed[key]) revert SessionAlreadyConsumed();

        bytes32 digest = _hashResult(result);
        address recovered = digest.recover(resultSignature);
        if (recovered != gameSigner) revert InvalidResultSignature();

        sessionUsed[key] = true;
        emit SessionConsumed(key);
        emit ResultAccepted(result.user, result.sessionId, result.xp, result.gameId);

        IWagerVault vault = wagerVault;
        if (address(vault) == address(0)) revert InvalidVault();
        vault.settle(result.user, result.sessionId, result.gameId, result.multiplierX100);

        REGISTRY.addXpWithSig(result.user, result.gameId, result.xp, xpDeadline, xpSignature);
    }

    function sessionKey(address user, uint256 gameId_, uint64 sessionId) public pure returns (bytes32) {
        return keccak256(abi.encode(user, gameId_, sessionId));
    }

    function gameId() external view returns (uint256) {
        return GAME_ID;
    }

    function hashResult(Result calldata result) external view returns (bytes32) {
        return _hashResult(result);
    }

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
                    result.score,
                    result.kills,
                    result.timeAlive,
                    result.wager,
                    result.multiplierX100,
                    result.xp,
                    result.deadline
                )
            )
        );
    }
}
