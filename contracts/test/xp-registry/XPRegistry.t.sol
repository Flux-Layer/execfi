// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {XPRegistry} from "../../src/xp-registry/XPRegistry.sol";

contract XPRegistryTest is Test {
  XPRegistry internal registry;

  uint256 internal signerPk;
  address internal signer;

  uint256 internal constant GAME_ID = 1;
  uint256 internal constant OTHER_GAME_ID = 2;
  uint256 internal constant RATE_LIMIT = 1_000_000 ether;

  function setUp() public {
    XPRegistry implementation = new XPRegistry();
    bytes memory initData = abi.encodeCall(XPRegistry.initialize, (address(this)));
    ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
    registry = XPRegistry(address(proxy));

    signerPk = 0xA11CE;
    signer = vm.addr(signerPk);

    registry.registerGame(GAME_ID, "Bomb Defuse", signer);
    registry.setGameRateLimit(GAME_ID, RATE_LIMIT);

    registry.registerGame(OTHER_GAME_ID, "Treasure Hunt", signer);
    registry.setGameRateLimit(OTHER_GAME_ID, RATE_LIMIT);
  }

  function _sign(
    address user,
    uint256 gameId,
    uint256 amount,
    uint256 nonce,
    uint256 deadline
  ) internal view returns (bytes memory sig) {
    bytes32 digest = registry.getDigest(user, gameId, amount, nonce, deadline);
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
    sig = abi.encodePacked(r, s, v);
  }

  function _submit(address user, uint256 gameId, uint256 amount) internal {
    uint256 nonce = registry.getNonce(user, gameId);
    uint256 deadline = block.timestamp + 1 hours;
    bytes memory sig = _sign(user, gameId, amount, nonce, deadline);
    registry.addXPWithSig(user, gameId, amount, deadline, sig);
  }

  function testRegisterGame() public {
    uint256 newGameId = 99;
    address newSigner = vm.addr(0xB0B);
    vm.expectEmit(true, true, false, true);
    emit XPRegistry.GameRegistered(newGameId, "Arena", newSigner, true);
    registry.registerGame(newGameId, "Arena", newSigner);

    (string memory name, address signerAddr, bool active) = registry.games(newGameId);
    assertEq(name, "Arena");
    assertEq(signerAddr, newSigner);
    assertTrue(active);
  }

  function testAddXPWithValidSignature() public {
    address user = address(0xBEEF);
    uint256 amount = 100 ether;
    uint256 nonce = registry.getNonce(user, GAME_ID);
    uint256 deadline = block.timestamp + 1 hours;
    bytes memory sig = _sign(user, GAME_ID, amount, nonce, deadline);

    registry.addXPWithSig(user, GAME_ID, amount, deadline, sig);

    assertEq(registry.xp(user, GAME_ID), amount);
    assertEq(registry.totalXP(user), amount);
    assertEq(registry.getNonce(user, GAME_ID), nonce + 1);
  }

  function testRejectInvalidSignature() public {
    address user = address(0xBEEF);
    uint256 amount = 10 ether;
    uint256 nonce = registry.getNonce(user, GAME_ID);
    uint256 deadline = block.timestamp + 1 hours;

    bytes32 digest = registry.getDigest(user, GAME_ID, amount, nonce, deadline);
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBADBAD, digest);
    bytes memory sig = abi.encodePacked(r, s, v);

    vm.expectRevert();
    registry.addXPWithSig(user, GAME_ID, amount, deadline, sig);
  }

  function testRejectExpiredDeadline() public {
    address user = address(0x1234);
    uint256 amount = 5 ether;
    uint256 nonce = registry.getNonce(user, GAME_ID);
    uint256 validDeadline = block.timestamp + 100;
    bytes memory sig = _sign(user, GAME_ID, amount, nonce, validDeadline);

    uint256 expiredDeadline = block.timestamp - 1;
    vm.expectRevert(abi.encodeWithSelector(XPRegistry.DeadlineExpired.selector, expiredDeadline));
    registry.addXPWithSig(user, GAME_ID, amount, expiredDeadline, sig);
  }

  function testRejectReplay() public {
    address user = address(0xAAAA);
    uint256 amount = 20 ether;
    uint256 nonce = registry.getNonce(user, GAME_ID);
    uint256 deadline = block.timestamp + 1 hours;
    bytes memory sig = _sign(user, GAME_ID, amount, nonce, deadline);

    registry.addXPWithSig(user, GAME_ID, amount, deadline, sig);

    vm.expectRevert();
    registry.addXPWithSig(user, GAME_ID, amount, deadline, sig);
  }

  function testPausedBlocksUpdates() public {
    address user = address(0x1111);
    uint256 amount = 1 ether;
    uint256 nonce = registry.getNonce(user, GAME_ID);
    uint256 deadline = block.timestamp + 1 hours;
    bytes memory sig = _sign(user, GAME_ID, amount, nonce, deadline);

    registry.pause();
    vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
    registry.addXPWithSig(user, GAME_ID, amount, deadline, sig);
  }

  function testInactiveGameRejected() public {
    registry.setGameActive(GAME_ID, false);
    address user = address(0x7777);
    uint256 amount = 2 ether;
    uint256 nonce = registry.getNonce(user, GAME_ID);
    uint256 deadline = block.timestamp + 1 hours;
    bytes memory sig = _sign(user, GAME_ID, amount, nonce, deadline);

    vm.expectRevert(abi.encodeWithSelector(XPRegistry.GameNotActive.selector, GAME_ID));
    registry.addXPWithSig(user, GAME_ID, amount, deadline, sig);
  }

  function testEmergencySignerRotationRequiresPause() public {
    vm.expectRevert(PausableUpgradeable.ExpectedPause.selector);
    registry.emergencySetGameSigner(GAME_ID, vm.addr(0xCAFE));

    registry.pause();
    address newSigner = vm.addr(0xCAFEBABE);
    registry.emergencySetGameSigner(GAME_ID, newSigner);
    registry.unpause();

    signerPk = 0xCAFEBABE;
    signer = newSigner;

    _submit(address(0x9999), GAME_ID, 3 ether);
  }

  function testRateLimit() public {
    registry.setGameRateLimit(GAME_ID, 50 ether);
    address user = address(0x8888);
    uint256 nonce = registry.getNonce(user, GAME_ID);
    uint256 deadline = block.timestamp + 1 hours;
    bytes memory sig = _sign(user, GAME_ID, 100 ether, nonce, deadline);

    vm.expectRevert(abi.encodeWithSelector(XPRegistry.AmountExceedsLimit.selector, 100 ether, 50 ether));
    registry.addXPWithSig(user, GAME_ID, 100 ether, deadline, sig);
  }

  function testTransferAdmin() public {
    address newAdmin = vm.addr(0xAD10);
    registry.transferAdmin(newAdmin);
    assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), newAdmin));
  }

  function testUpgradeFlow() public {
    XPRegistryV2Mock newImpl = new XPRegistryV2Mock();
    registry.upgradeToAndCall(address(newImpl), bytes(""));
    assertEq(XPRegistryV2Mock(address(registry)).version(), "XPRegistry v2");
  }

  function testUpgradeRequiresAdmin() public {
    XPRegistryV2Mock newImpl = new XPRegistryV2Mock();
    address attacker = address(0xDEAD);
    vm.expectRevert();
    vm.prank(attacker);
    registry.upgradeToAndCall(address(newImpl), bytes(""));
  }

  function testInvariantTotalMatchesSum() public {
    address user = address(0xABCD);
    _submit(user, GAME_ID, 40 ether);
    _submit(user, OTHER_GAME_ID, 60 ether);

    uint256 total = registry.totalXP(user);
    uint256 sum = registry.xp(user, GAME_ID) + registry.xp(user, OTHER_GAME_ID);
    assertEq(total, sum);
  }

  function testGasAddXP() public {
    address user = address(0x5555);
    uint256 amount = 25 ether;
    uint256 nonce = registry.getNonce(user, GAME_ID);
    uint256 deadline = block.timestamp + 1 hours;
    bytes memory sig = _sign(user, GAME_ID, amount, nonce, deadline);

    uint256 gasBefore = gasleft();
    registry.addXPWithSig(user, GAME_ID, amount, deadline, sig);
    uint256 gasAfter = gasleft();

    assertLt(gasBefore - gasAfter, 120_000);
  }

  function testFuzzAddXP(uint256 amount, address user) public {
    vm.assume(user != address(0) && user != signer);
    uint256 boundedAmount = bound(amount, 1, RATE_LIMIT);

    uint256 nonce = registry.getNonce(user, GAME_ID);
    uint256 deadline = block.timestamp + 1 days;
    bytes memory sig = _sign(user, GAME_ID, boundedAmount, nonce, deadline);

    registry.addXPWithSig(user, GAME_ID, boundedAmount, deadline, sig);
    assertEq(registry.xp(user, GAME_ID), boundedAmount);
    assertEq(registry.totalXP(user), boundedAmount);
  }
}

contract XPRegistryV2Mock is XPRegistry {
  function version() external pure returns (string memory) {
    return "XPRegistry v2";
  }
}
