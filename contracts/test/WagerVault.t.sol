// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {WagerVault} from "../src/degenshoot/WagerVault.sol";
import {IDegenshoot} from "../src/degenshoot/interfaces/IDegenshoot.sol";

contract MockDegenshoot is IDegenshoot {
    uint256 public immutable GAME_ID_CONST;
    mapping(bytes32 => bool) private _sessionUsed;

    constructor(uint256 gameId_) {
        GAME_ID_CONST = gameId_;
    }

    function markSession(address user, uint64 sessionId, uint256 gameId_) external returns (bytes32 key) {
        key = sessionKey(user, gameId_, sessionId);
        _sessionUsed[key] = true;
    }

    function setSessionUsed(bytes32 key, bool value) external {
        _sessionUsed[key] = value;
    }

    function sessionKey(address user, uint256 gameId_, uint64 sessionId) public pure override returns (bytes32) {
        return keccak256(abi.encode(user, gameId_, sessionId));
    }

    function sessionUsed(bytes32 key) external view override returns (bool) {
        return _sessionUsed[key];
    }

    function gameId() external view override returns (uint256) {
        return GAME_ID_CONST;
    }
}

contract WagerVaultTest is Test {
    uint256 internal constant GAME_ID = 1;
    uint16 internal constant FEE_BPS = 500; // 5%

    address internal admin = address(0xA11CE);
    address internal treasury = address(0xBEEF);
    address internal bettor = address(0xCAFE);

    MockDegenshoot internal degenshoot;
    WagerVault internal vault;

    function setUp() public {
        degenshoot = new MockDegenshoot(GAME_ID);
        vault = new WagerVault(admin, address(degenshoot), treasury, FEE_BPS);

        vm.deal(bettor, 10 ether);
        vm.deal(admin, 0);
        vm.deal(treasury, 0);
    }

    function _placeBet(uint64 sessionId, uint256 amount) internal returns (bytes32 key) {
        key = degenshoot.sessionKey(bettor, GAME_ID, sessionId);
        vm.prank(bettor);
        vault.placeBet{value: amount}(sessionId);
    }

    function testPlaceBetAndSettleAndWithdraw() public {
        bytes32 key = _placeBet(1, 1 ether);

        degenshoot.setSessionUsed(key, true);

        // Fund vault so it can cover payouts exceeding the stake
        vm.deal(admin, 5 ether);
        vm.prank(admin);
        (bool ok, ) = address(vault).call{value: 1 ether}("");
        require(ok);

        vm.prank(address(degenshoot));
        vault.settle(bettor, 1, GAME_ID, 150);

        uint256 expectedGross = 1 ether * 150 / 100;
        uint256 expectedFee = (expectedGross * FEE_BPS) / 10_000;
        uint256 expectedNet = expectedGross - expectedFee;

        assertEq(vault.balances(bettor), expectedNet);
        assertEq(vault.balances(treasury), expectedFee);

        vm.prank(bettor);
        vault.withdraw(expectedNet);
        assertEq(bettor.balance, 10 ether - 1 ether + expectedNet);
    }

    function testPlaceBetZeroValueReverts() public {
        vm.expectRevert(WagerVault.InvalidAmount.selector);
        vm.prank(bettor);
        vault.placeBet{value: 0}(1);
    }

    function testPlaceBetTwiceReverts() public {
        _placeBet(1, 1 ether);
        vm.expectRevert(WagerVault.BetAlreadyPlaced.selector);
        vm.prank(bettor);
        vault.placeBet{value: 0.5 ether}(1);
    }

    function testPlaceBetOnConsumedSessionReverts() public {
        bytes32 key = degenshoot.sessionKey(bettor, GAME_ID, 1);
        degenshoot.setSessionUsed(key, true);
        vm.expectRevert(WagerVault.SessionConsumed.selector);
        vm.prank(bettor);
        vault.placeBet{value: 1 ether}(1);
    }

    function testSettleWithoutEscrowReverts() public {
        bytes32 key = degenshoot.sessionKey(bettor, GAME_ID, 1);
        degenshoot.setSessionUsed(key, true);
        vm.expectRevert(WagerVault.NoEscrow.selector);
        vm.prank(address(degenshoot));
        vault.settle(bettor, 1, GAME_ID, 100);
    }

    function testSettleWithoutSessionVerificationReverts() public {
        _placeBet(1, 1 ether);
        vm.expectRevert(WagerVault.SessionNotVerified.selector);
        vm.prank(address(degenshoot));
        vault.settle(bettor, 1, GAME_ID, 100);
    }

    function testSettleTwiceReverts() public {
        bytes32 key = _placeBet(1, 1 ether);
        degenshoot.setSessionUsed(key, true);

        vm.prank(address(degenshoot));
        vault.settle(bettor, 1, GAME_ID, 120);

        vm.expectRevert(WagerVault.AlreadySettled.selector);
        vm.prank(address(degenshoot));
        vault.settle(bettor, 1, GAME_ID, 120);
    }

    function testOnlyDegenshootCanSettle() public {
        bytes32 key = _placeBet(1, 1 ether);
        degenshoot.setSessionUsed(key, true);

        vm.expectRevert(bytes("WagerVault: not degenshoot"));
        vault.settle(bettor, 1, GAME_ID, 100);
    }

    function testWithdrawInsufficientBalanceReverts() public {
        vm.expectRevert(WagerVault.InvalidAmount.selector);
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
        vault.setHouseFeeBps(100);
        assertEq(vault.houseFeeBps(), 100);
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
        vm.expectRevert(WagerVault.InvalidFee.selector);
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

        vault = new WagerVault(admin, address(degenshoot), treasury, feeBps);
        vm.prank(bettor);
        vault.placeBet{value: 1 ether}(1);
        bytes32 key = degenshoot.sessionKey(bettor, GAME_ID, 1);
        degenshoot.setSessionUsed(key, true);

        vm.prank(address(degenshoot));
        vault.settle(bettor, 1, GAME_ID, multiplierX100);

        uint256 gross = 1 ether * multiplierX100 / 100;
        uint256 fee = (gross * feeBps) / 10_000;
        uint256 net = gross - fee;
        uint256 remainder = gross < 1 ether ? 1 ether - gross : 0;

        assertEq(vault.balances(bettor), net);
        assertEq(vault.balances(treasury), fee + remainder);
    }

    function testLosingBetCreditsTreasuryRemainder() public {
        bytes32 key = _placeBet(1, 1 ether);
        degenshoot.setSessionUsed(key, true);

        vm.prank(address(degenshoot));
        vault.settle(bettor, 1, GAME_ID, 75);

        uint256 gross = 1 ether * 75 / 100;
        uint256 fee = (gross * FEE_BPS) / 10_000;
        uint256 remainder = 1 ether - gross;

        assertEq(vault.balances(bettor), gross - fee);
        assertEq(vault.balances(treasury), fee + remainder);
    }

    function testAdminRefundEscrow() public {
        bytes32 key = _placeBet(1, 1 ether);
        vm.expectRevert(WagerVault.InvalidRecipient.selector);
        vm.prank(admin);
        vault.adminRefundEscrow(key, address(0));

        vm.prank(admin);
        vault.adminRefundEscrow(key, bettor);
        assertEq(vault.escrow(key), 0);
        assertEq(bettor.balance, 10 ether);
    }
}
