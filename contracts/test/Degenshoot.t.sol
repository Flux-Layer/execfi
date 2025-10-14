// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Degenshoot} from "../degenshoot/Degenshoot.sol";
import {IXPRegistry} from "../interfaces/IXPRegistry.sol";
import {IWagerVault} from "../interfaces/IWagerVault.sol";

contract MockXPRegistry is IXPRegistry {
    struct CallData {
        address user;
        uint256 gameId;
        uint256 amount;
        uint256 deadline;
        bytes signature;
    }

    mapping(address => mapping(uint256 => uint256)) public nonces;
    CallData internal _lastCall;
    bool public shouldRevert;

    event XPAdded(address indexed user, uint256 indexed gameId, uint256 amount, uint256 deadline);

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function addXpWithSig(
        address user,
        uint256 gameId,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external override {
        if (shouldRevert) revert("XP registry mock revert");
        _lastCall = CallData({user: user, gameId: gameId, amount: amount, deadline: deadline, signature: signature});
        nonces[user][gameId] += 1;
        emit XPAdded(user, gameId, amount, deadline);
    }

    function lastCall() external view returns (CallData memory) {
        return _lastCall;
    }

    function getNonce(address account, uint256 gameId) external view override returns (uint256) {
        return nonces[account][gameId];
    }

    function domainSeparator() external pure override returns (bytes32) {
        return bytes32(0);
    }
}

contract MockWagerVault is IWagerVault {
    struct CallData {
        address user;
        uint64 sessionId;
        uint256 gameId;
        uint256 multiplierX100;
    }

    uint256 public immutable GAME_ID_CONST;
    CallData internal _lastCall;

    constructor(uint256 gameId_) {
        GAME_ID_CONST = gameId_;
    }

    function settle(address user, uint64 sessionId, uint256 gameId_, uint256 multiplierX100) external override {
        _lastCall = CallData({
            user: user,
            sessionId: sessionId,
            gameId: gameId_,
            multiplierX100: multiplierX100
        });
    }

    function gameId() external view override returns (uint256) {
        return GAME_ID_CONST;
    }

    function lastCall() external view returns (CallData memory) {
        return _lastCall;
    }
}

contract DegenshootTest is Test {
    uint256 internal constant GAME_ID = 1;

    uint256 internal adminPk = 0xA11CE;
    address internal admin = vm.addr(adminPk);

    uint256 internal signerPk = 0xB0B;
    address internal signer = vm.addr(signerPk);

    address internal user = vm.addr(0xC0FFEE);

    MockXPRegistry internal registry;
    Degenshoot internal degenshoot;
    MockWagerVault internal vault;

    function setUp() public {
        vm.chainId(84532);
        registry = new MockXPRegistry();
        degenshoot = new Degenshoot(admin, signer, address(registry), GAME_ID);
        vault = new MockWagerVault(GAME_ID);
        vm.prank(admin);
        degenshoot.setWagerVault(address(vault));
    }

    function _defaultResult() internal view returns (Degenshoot.Result memory r) {
        r = Degenshoot.Result({
            user: user,
            gameId: GAME_ID,
            sessionId: 1,
            score: 1000,
            kills: 5,
            timeAlive: 420,
            wager: 0.05 ether,
            multiplierX100: 150,
            xp: 250,
            deadline: block.timestamp + 1 hours
        });
    }

    function _signResult(Degenshoot.Result memory r) internal view returns (bytes memory) {
        return _signResultFor(degenshoot, r);
    }

    function _signResultFor(Degenshoot target, Degenshoot.Result memory r) internal view returns (bytes memory) {
        bytes32 digest = target.hashResult(r);
        (uint8 v, bytes32 rSig, bytes32 sSig) = vm.sign(signerPk, digest);
        return abi.encodePacked(rSig, sSig, v);
    }

    function testSubmitResultAndClaimXPSuccess() public {
        Degenshoot.Result memory result = _defaultResult();
        bytes memory sig = _signResult(result);
        uint256 xpDeadline = block.timestamp + 1 hours;

        bytes32 key = degenshoot.sessionKey(result.user, result.gameId, result.sessionId);
        degenshoot.submitResultAndClaimXP(result, sig, xpDeadline, bytes("xp"));

        assertTrue(degenshoot.sessionUsed(key));
        MockXPRegistry.CallData memory callData = registry.lastCall();
        assertEq(callData.user, result.user);
        assertEq(callData.gameId, result.gameId);
        assertEq(callData.amount, result.xp);

        MockWagerVault.CallData memory vaultCall = vault.lastCall();
        assertEq(vaultCall.user, result.user);
        assertEq(vaultCall.sessionId, result.sessionId);
        assertEq(vaultCall.gameId, result.gameId);
        assertEq(vaultCall.multiplierX100, result.multiplierX100);
    }

    function testSubmitResultRevertsWhenExpired() public {
        Degenshoot.Result memory result = _defaultResult();
        result.deadline = block.timestamp - 1;
        bytes memory sig = _signResult(result);
        vm.expectRevert(Degenshoot.ResultExpired.selector);
        degenshoot.submitResultAndClaimXP(result, sig, block.timestamp + 1 hours, bytes("xp"));
    }

    function testSubmitResultRevertsWhenXpDeadlineExpired() public {
        Degenshoot.Result memory result = _defaultResult();
        bytes memory sig = _signResult(result);
        uint256 xpDeadline = block.timestamp - 1;
        vm.expectRevert(Degenshoot.ResultExpired.selector);
        degenshoot.submitResultAndClaimXP(result, sig, xpDeadline, bytes("xp"));
    }

    function testSubmitResultRevertsOnReplay() public {
        Degenshoot.Result memory result = _defaultResult();
        bytes memory sig = _signResult(result);
        uint256 xpDeadline = block.timestamp + 1 hours;
        degenshoot.submitResultAndClaimXP(result, sig, xpDeadline, bytes("xp"));

        vm.expectRevert(Degenshoot.SessionAlreadyConsumed.selector);
        degenshoot.submitResultAndClaimXP(result, sig, xpDeadline, bytes("xp"));
    }

    function testSubmitResultRevertsOnBadSigner() public {
        Degenshoot.Result memory result = _defaultResult();
        bytes32 digest = degenshoot.hashResult(result);
        (uint8 v, bytes32 rSig, bytes32 sSig) = vm.sign(0x12341234, digest);
        bytes memory sig = abi.encodePacked(rSig, sSig, v);

        vm.expectRevert(Degenshoot.InvalidResultSignature.selector);
        degenshoot.submitResultAndClaimXP(result, sig, block.timestamp + 1 hours, bytes("xp"));
    }

    function testSubmitResultRevertsOnInvalidGameId() public {
        Degenshoot.Result memory result = _defaultResult();
        result.gameId = 123;
        bytes memory sig = _signResult(result);
        vm.expectRevert(Degenshoot.InvalidResult.selector);
        degenshoot.submitResultAndClaimXP(result, sig, block.timestamp + 1 hours, bytes("xp"));
    }

    function testSubmitResultRevertsOnZeroUser() public {
        Degenshoot.Result memory result = _defaultResult();
        result.user = address(0);
        bytes memory sig = _signResult(result);
        vm.expectRevert(Degenshoot.InvalidResult.selector);
        degenshoot.submitResultAndClaimXP(result, sig, block.timestamp + 1 hours, bytes("xp"));
    }

    function testSubmitResultRevertsOnZeroXp() public {
        Degenshoot.Result memory result = _defaultResult();
        result.xp = 0;
        bytes memory sig = _signResult(result);
        vm.expectRevert(Degenshoot.InvalidResult.selector);
        degenshoot.submitResultAndClaimXP(result, sig, block.timestamp + 1 hours, bytes("xp"));
    }

    function testSubmitResultRevertsWhenPaused() public {
        vm.prank(admin);
        degenshoot.pause();

        Degenshoot.Result memory result = _defaultResult();
        bytes memory sig = _signResult(result);

        vm.expectRevert(bytes4(keccak256("EnforcedPause()")));
        degenshoot.submitResultAndClaimXP(result, sig, block.timestamp + 1 hours, bytes("xp"));
    }

    function testSetGameSigner() public {
        address newSigner = vm.addr(0xDEADBEEF);
        vm.prank(admin);
        degenshoot.setGameSigner(newSigner);
        assertEq(degenshoot.gameSigner(), newSigner);
    }

    function testSetWagerVault() public {
        MockWagerVault newVault = new MockWagerVault(GAME_ID);
        vm.prank(admin);
        degenshoot.setWagerVault(address(newVault));
        assertEq(address(degenshoot.wagerVault()), address(newVault));
    }

    function testSetWagerVaultRevertsOnZero() public {
        vm.prank(admin);
        vm.expectRevert(Degenshoot.InvalidVault.selector);
        degenshoot.setWagerVault(address(0));
    }

    function testSetWagerVaultRevertsOnMismatchedGame() public {
        MockWagerVault invalidVault = new MockWagerVault(999);
        vm.prank(admin);
        vm.expectRevert(Degenshoot.InvalidVault.selector);
        degenshoot.setWagerVault(address(invalidVault));
    }

    function testSubmitResultRevertsWhenVaultNotConfigured() public {
        Degenshoot unconfigured = new Degenshoot(admin, signer, address(registry), GAME_ID);
        Degenshoot.Result memory result = _defaultResult();
        bytes memory sig = _signResultFor(unconfigured, result);
        uint256 xpDeadline = block.timestamp + 1 hours;

        vm.expectRevert(Degenshoot.InvalidVault.selector);
        unconfigured.submitResultAndClaimXP(result, sig, xpDeadline, bytes("xp"));
    }
}
