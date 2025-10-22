// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CoinFlipGame} from "../src/coinflip/CoinFlipGame.sol";
import {CoinFlipVault} from "../src/coinflip/CoinFlipVault.sol";
import {ICoinFlipVault} from "../src/coinflip/interfaces/ICoinFlipVault.sol";
import {IXPRegistry} from "../src/shared/IXPRegistry.sol";
import {ICoinFlip} from "../src/coinflip/interfaces/ICoinFlip.sol";

contract MockCoinFlipXPRegistry is IXPRegistry {
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

contract MockCoinFlipVault is ICoinFlipVault {
    struct CallData {
        address user;
        uint64 sessionId;
        uint256 gameId;
        uint256 multiplierX100;
        uint8 outcome;
        uint8 guess;
    }

    uint256 public immutable GAME_ID_CONST;
    CallData internal _lastCall;

    constructor(uint256 gameId_) {
        GAME_ID_CONST = gameId_;
    }

    function settle(
        address user,
        uint64 sessionId,
        uint256 gameId_,
        uint256 multiplierX100,
        uint8 outcome,
        uint8 guess
    ) external override {
        _lastCall = CallData({
            user: user,
            sessionId: sessionId,
            gameId: gameId_,
            multiplierX100: multiplierX100,
            outcome: outcome,
            guess: guess
        });
    }

    function gameId() external view override returns (uint256) {
        return GAME_ID_CONST;
    }

    function lastCall() external view returns (CallData memory) {
        return _lastCall;
    }
}

contract CoinFlipGameTest is Test {
    uint256 internal constant GAME_ID = 2;

    uint256 internal adminPk = 0xA11CE;
    address internal admin = vm.addr(adminPk);

    uint256 internal signerPk = 0xB0B;
    address internal signer = vm.addr(signerPk);

    address internal user = vm.addr(0xC0FFEE);

    MockCoinFlipXPRegistry internal registry;
    CoinFlipGame internal coinFlip;
    MockCoinFlipVault internal vault;

    function setUp() public {
        vm.chainId(84532);
        registry = new MockCoinFlipXPRegistry();
        coinFlip = new CoinFlipGame(admin, signer, address(registry), GAME_ID);
        vault = new MockCoinFlipVault(GAME_ID);
        vm.prank(admin);
        coinFlip.setVault(address(vault));
    }

    function _defaultResult() internal view returns (CoinFlipGame.Result memory r) {
        r = CoinFlipGame.Result({
            user: user,
            gameId: GAME_ID,
            sessionId: 1,
            guess: 0,
            outcome: 0,
            wager: 0.05 ether,
            multiplierX100: 200,
            xp: 150,
            deadline: block.timestamp + 1 hours
        });
    }

    function _signResult(CoinFlipGame.Result memory r) internal view returns (bytes memory) {
        return _signResultFor(coinFlip, r);
    }

    function _signResultFor(CoinFlipGame target, CoinFlipGame.Result memory r) internal view returns (bytes memory) {
        bytes32 digest = target.hashResult(r);
        (uint8 v, bytes32 rSig, bytes32 sSig) = vm.sign(signerPk, digest);
        return abi.encodePacked(rSig, sSig, v);
    }

    function testSubmitResultAndClaimXPSuccess() public {
        CoinFlipGame.Result memory result = _defaultResult();
        bytes memory sig = _signResult(result);
        uint256 xpDeadline = block.timestamp + 1 hours;

        bytes32 key = coinFlip.sessionKey(result.user, result.gameId, result.sessionId);
        coinFlip.submitResultAndClaimXP(result, sig, xpDeadline, bytes("xp"));

        assertTrue(coinFlip.sessionUsed(key));

        MockCoinFlipXPRegistry.CallData memory xpCall = registry.lastCall();
        assertEq(xpCall.user, result.user);
        assertEq(xpCall.gameId, result.gameId);
        assertEq(xpCall.amount, result.xp);
        assertEq(xpCall.deadline, xpDeadline);

        MockCoinFlipVault.CallData memory vaultCall = vault.lastCall();
        assertEq(vaultCall.user, result.user);
        assertEq(vaultCall.sessionId, result.sessionId);
        assertEq(vaultCall.gameId, result.gameId);
        assertEq(vaultCall.multiplierX100, result.multiplierX100);
        assertEq(vaultCall.outcome, result.outcome);
        assertEq(vaultCall.guess, result.guess);
    }

    function testSubmitResultRevertsWhenOutcomeInvalid() public {
        CoinFlipGame.Result memory result = _defaultResult();
        result.outcome = 2;
        bytes memory sig = _signResult(result);
        vm.expectRevert(CoinFlipGame.InvalidResult.selector);
        coinFlip.submitResultAndClaimXP(result, sig, block.timestamp + 1 hours, bytes("xp"));
    }

    function testSubmitResultRevertsWhenGuessInvalid() public {
        CoinFlipGame.Result memory result = _defaultResult();
        result.guess = 3;
        bytes memory sig = _signResult(result);
        vm.expectRevert(CoinFlipGame.InvalidResult.selector);
        coinFlip.submitResultAndClaimXP(result, sig, block.timestamp + 1 hours, bytes("xp"));
    }

    function testSubmitResultRevertsWhenExpired() public {
        CoinFlipGame.Result memory result = _defaultResult();
        result.deadline = block.timestamp - 1;
        bytes memory sig = _signResult(result);
        vm.expectRevert(CoinFlipGame.ResultExpired.selector);
        coinFlip.submitResultAndClaimXP(result, sig, block.timestamp + 1 hours, bytes("xp"));
    }

    function testSubmitResultRevertsWhenXpDeadlineExpired() public {
        CoinFlipGame.Result memory result = _defaultResult();
        bytes memory sig = _signResult(result);
        uint256 xpDeadline = block.timestamp - 1;
        vm.expectRevert(CoinFlipGame.ResultExpired.selector);
        coinFlip.submitResultAndClaimXP(result, sig, xpDeadline, bytes("xp"));
    }

    function testSubmitResultRevertsOnReplay() public {
        CoinFlipGame.Result memory result = _defaultResult();
        bytes memory sig = _signResult(result);
        uint256 xpDeadline = block.timestamp + 1 hours;
        coinFlip.submitResultAndClaimXP(result, sig, xpDeadline, bytes("xp"));

        vm.expectRevert(CoinFlipGame.SessionAlreadyConsumed.selector);
        coinFlip.submitResultAndClaimXP(result, sig, xpDeadline, bytes("xp"));
    }

    function testSubmitResultRevertsOnBadSigner() public {
        CoinFlipGame.Result memory result = _defaultResult();
        bytes32 digest = coinFlip.hashResult(result);
        (uint8 v, bytes32 rSig, bytes32 sSig) = vm.sign(0xDEADBEEF, digest);
        bytes memory sig = abi.encodePacked(rSig, sSig, v);

        vm.expectRevert(CoinFlipGame.InvalidSignature.selector);
        coinFlip.submitResultAndClaimXP(result, sig, block.timestamp + 1 hours, bytes("xp"));
    }

    function testSubmitResultRevertsOnInvalidGameId() public {
        CoinFlipGame.Result memory result = _defaultResult();
        result.gameId = 999;
        bytes memory sig = _signResult(result);
        vm.expectRevert(CoinFlipGame.InvalidResult.selector);
        coinFlip.submitResultAndClaimXP(result, sig, block.timestamp + 1 hours, bytes("xp"));
    }

    function testSubmitResultRevertsWhenVaultUnset() public {
        CoinFlipGame.Result memory result = _defaultResult();
        CoinFlipGame fresh = new CoinFlipGame(admin, signer, address(registry), GAME_ID);
        bytes memory sig = _signResultFor(fresh, result);
        vm.expectRevert(CoinFlipGame.InvalidVault.selector);
        fresh.submitResultAndClaimXP(result, sig, block.timestamp + 1 hours, bytes("xp"));
    }

    function testSubmitResultRevertsWhenPaused() public {
        vm.prank(admin);
        coinFlip.pause();

        CoinFlipGame.Result memory result = _defaultResult();
        bytes memory sig = _signResult(result);

        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        coinFlip.submitResultAndClaimXP(result, sig, block.timestamp + 1 hours, bytes("xp"));

        vm.prank(admin);
        coinFlip.unpause();

        coinFlip.submitResultAndClaimXP(result, sig, block.timestamp + 1 hours, bytes("xp"));
    }

    function testSignerRotation() public {
        CoinFlipGame.Result memory result = _defaultResult();
        bytes memory oldSig = _signResult(result);

        vm.prank(admin);
        uint256 newSignerPk = 0x123456;
        address newSigner = vm.addr(newSignerPk);
        coinFlip.setGameSigner(newSigner);

        vm.expectRevert(CoinFlipGame.InvalidSignature.selector);
        coinFlip.submitResultAndClaimXP(result, oldSig, block.timestamp + 1 hours, bytes("xp"));

        bytes32 digest = coinFlip.hashResult(result);
        (uint8 v, bytes32 rSig, bytes32 sSig) = vm.sign(newSignerPk, digest);
        bytes memory newSig = abi.encodePacked(rSig, sSig, v);
        coinFlip.submitResultAndClaimXP(result, newSig, block.timestamp + 1 hours, bytes("xp"));
    }

    function testSubmitResultRevertsWhenXPZero() public {
        CoinFlipGame.Result memory result = _defaultResult();
        result.xp = 0;
        bytes memory sig = _signResult(result);
        vm.expectRevert(CoinFlipGame.InvalidResult.selector);
        coinFlip.submitResultAndClaimXP(result, sig, block.timestamp + 1 hours, bytes("xp"));
    }

    function testSubmitResultRevertsWhenRegistryFails() public {
        CoinFlipGame.Result memory result = _defaultResult();
        bytes memory sig = _signResult(result);
        registry.setShouldRevert(true);
        vm.expectRevert(bytes("XP registry mock revert"));
        coinFlip.submitResultAndClaimXP(result, sig, block.timestamp + 1 hours, bytes("xp"));
    }

    function testSetVaultRequiresMatchingGameId() public {
        MockCoinFlipVault wrongVault = new MockCoinFlipVault(999);
        vm.prank(admin);
        vm.expectRevert(CoinFlipGame.InvalidVault.selector);
        coinFlip.setVault(address(wrongVault));
    }

    function testSetGameSignerRequiresAdmin() public {
        address outsider = vm.addr(0x8888);
        vm.expectRevert(CoinFlipGame.InvalidResult.selector);
        vm.prank(outsider);
        coinFlip.setGameSigner(outsider);
    }

    function testSetVaultRequiresAdmin() public {
        MockCoinFlipVault otherVault = new MockCoinFlipVault(GAME_ID);
        address outsider = vm.addr(0x9999);
        vm.expectRevert(CoinFlipGame.InvalidResult.selector);
        vm.prank(outsider);
        coinFlip.setVault(address(otherVault));
    }
}

contract MockCoinFlipGame is ICoinFlip {
    uint256 public immutable GAME_ID_CONST;
    mapping(bytes32 => bool) private _sessionUsed;

    constructor(uint256 gameId_) {
        GAME_ID_CONST = gameId_;
    }

    function sessionKey(address user, uint256 gameId_, uint64 sessionId) public pure override returns (bytes32) {
        return keccak256(abi.encode(user, gameId_, sessionId));
    }

    function sessionUsed(bytes32 key) external view override returns (bool) {
        return _sessionUsed[key];
    }

    function setSessionUsed(bytes32 key, bool value) external {
        _sessionUsed[key] = value;
    }

    function markSession(address user, uint64 sessionId, uint256 gameId_) external returns (bytes32 key) {
        key = sessionKey(user, gameId_, sessionId);
        _sessionUsed[key] = true;
    }

    function gameId() external view override returns (uint256) {
        return GAME_ID_CONST;
    }
}

contract CoinFlipVaultTest is Test {
    uint256 internal constant GAME_ID = 2;
    uint16 internal constant FEE_BPS = 400; // 4%

    address internal admin = address(0xA11CE);
    address internal treasury = address(0xBEEF);
    address internal bettor = address(0xCAFE);

    MockCoinFlipGame internal coinFlip;
    CoinFlipVault internal vault;

    function setUp() public {
        coinFlip = new MockCoinFlipGame(GAME_ID);
        vault = new CoinFlipVault(admin, address(coinFlip), treasury, FEE_BPS);

        vm.deal(bettor, 10 ether);
        vm.deal(admin, 0);
        vm.deal(treasury, 0);
    }

    function _sessionKey(uint64 sessionId) internal view returns (bytes32) {
        return coinFlip.sessionKey(bettor, GAME_ID, sessionId);
    }

    function _placeBet(uint64 sessionId, uint256 amount) internal returns (bytes32 key) {
        key = _sessionKey(sessionId);
        vm.prank(bettor);
        vault.placeBet{value: amount}(sessionId);
    }

    function testPlaceBetAndSettleAndWithdraw() public {
        bytes32 key = _placeBet(1, 1 ether);
        coinFlip.setSessionUsed(key, true);

        vm.deal(admin, 2 ether);
        vm.prank(admin);
        (bool ok, ) = address(vault).call{value: 1 ether}("");
        require(ok);

        vm.prank(address(coinFlip));
        vault.settle(bettor, 1, GAME_ID, 160, 0, 0);

        uint256 gross = 1 ether * 160 / 100;
        uint256 fee = (gross * FEE_BPS) / 10_000;
        uint256 net = gross - fee;

        assertEq(vault.balances(bettor), net);
        assertEq(vault.balances(treasury), fee);

        vm.prank(bettor);
        vault.withdraw(net);
        assertEq(bettor.balance, 10 ether - 1 ether + net);
    }

    function testPlaceBetZeroValueReverts() public {
        vm.expectRevert(CoinFlipVault.InvalidAmount.selector);
        vm.prank(bettor);
        vault.placeBet{value: 0}(1);
    }

    function testPlaceBetTwiceReverts() public {
        _placeBet(1, 0.5 ether);
        vm.expectRevert(CoinFlipVault.BetAlreadyPlaced.selector);
        vm.prank(bettor);
        vault.placeBet{value: 0.25 ether}(1);
    }

    function testPlaceBetOnConsumedSessionReverts() public {
        bytes32 key = _sessionKey(1);
        coinFlip.setSessionUsed(key, true);
        vm.expectRevert(CoinFlipVault.SessionConsumed.selector);
        vm.prank(bettor);
        vault.placeBet{value: 1 ether}(1);
    }

    function testSettleWithoutEscrowReverts() public {
        bytes32 key = _sessionKey(1);
        coinFlip.setSessionUsed(key, true);
        vm.expectRevert(CoinFlipVault.NoEscrow.selector);
        vm.prank(address(coinFlip));
        vault.settle(bettor, 1, GAME_ID, 100, 0, 0);
    }

    function testSettleWithoutSessionVerificationReverts() public {
        _placeBet(1, 1 ether);
        vm.expectRevert(CoinFlipVault.SessionNotVerified.selector);
        vm.prank(address(coinFlip));
        vault.settle(bettor, 1, GAME_ID, 100, 0, 0);
    }

    function testSettleTwiceReverts() public {
        bytes32 key = _placeBet(1, 1 ether);
        coinFlip.setSessionUsed(key, true);

        vm.prank(address(coinFlip));
        vault.settle(bettor, 1, GAME_ID, 120, 1, 0);

        vm.expectRevert(CoinFlipVault.AlreadySettled.selector);
        vm.prank(address(coinFlip));
        vault.settle(bettor, 1, GAME_ID, 120, 1, 0);
    }

    function testOnlyGameContractCanSettle() public {
        bytes32 key = _placeBet(1, 1 ether);
        coinFlip.setSessionUsed(key, true);

        vm.expectRevert(bytes("CoinFlipVault: not game contract"));
        vault.settle(bettor, 1, GAME_ID, 100, 0, 0);
    }

    function testWithdrawInsufficientBalanceReverts() public {
        vm.expectRevert(CoinFlipVault.InvalidAmount.selector);
        vault.withdraw(1 ether);
    }

    function testSetTreasury() public {
        address newTreasury = address(0x1234);
        vm.prank(admin);
        vault.setTreasury(newTreasury);
        assertEq(vault.treasury(), newTreasury);
    }

    function testSetHouseFeeBps() public {
        vm.prank(admin);
        vault.setHouseFeeBps(250);
        assertEq(vault.houseFeeBps(), 250);
    }

    function testSettersRestricted() public {
        address nonAdmin = address(0xDEAD);
        vm.startPrank(nonAdmin);
        vm.expectRevert();
        vault.setTreasury(address(1));
        vm.expectRevert();
        vault.setHouseFeeBps(200);
        vm.stopPrank();
    }

    function testSetHouseFeeBpsRevertsAboveMax() public {
        vm.prank(admin);
        vm.expectRevert(CoinFlipVault.InvalidFee.selector);
        vault.setHouseFeeBps(10_001);
    }

    function testEmergencyWithdrawByAdmin() public {
        vm.deal(address(this), 1 ether);
        (bool ok, ) = address(vault).call{value: 1 ether}("");
        require(ok);

        vm.prank(admin);
        vault.emergencyWithdraw(admin);

        assertEq(admin.balance, 1 ether);
    }

    function testEmergencyWithdrawRestricted() public {
        vm.deal(address(this), 1 ether);
        (bool ok, ) = address(vault).call{value: 1 ether}("");
        require(ok);

        vm.prank(bettor);
        vm.expectRevert();
        vault.emergencyWithdraw(bettor);
    }

    function testFuzzSettleFeeCalculation(uint16 feeBps, uint256 multiplierX100) public {
        vm.assume(feeBps <= 10_000);
        vm.assume(multiplierX100 > 0 && multiplierX100 < 10_000);

        vault = new CoinFlipVault(admin, address(coinFlip), treasury, feeBps);
        vm.prank(bettor);
        vault.placeBet{value: 1 ether}(1);
        bytes32 key = _sessionKey(1);
        coinFlip.setSessionUsed(key, true);

        vm.prank(address(coinFlip));
        vault.settle(bettor, 1, GAME_ID, multiplierX100, 1, 0);

        uint256 gross = 1 ether * multiplierX100 / 100;
        uint256 fee = (gross * feeBps) / 10_000;
        uint256 net = gross - fee;
        uint256 remainder = gross < 1 ether ? 1 ether - gross : 0;

        assertEq(vault.balances(bettor), net);
        assertEq(vault.balances(treasury), fee + remainder);
    }
}
