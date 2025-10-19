// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {XPRegistry} from "../xp-registry/contracts/XPRegistry.sol";

contract RegisterGreenvaleGame is Script {
  function run() external {
    address registryAddress = 0xBf227816Afc11b5DD720d601ECC14Fc5901C380b;
    uint256 adminKey = 0x1668d003bc6fd3624b27e7af247ca656f5656e17b5fc77469040df43ff7c68e8;
    uint256 gameId = 99;
    string memory gameName = "mallware";
    address signer = 0x1C79F0Bbe94cE84a3052BCea50FEf817765d53B1;

    XPRegistry registry = XPRegistry(registryAddress);

    address adminAddress = vm.addr(adminKey);
    bool hasAdminRole = registry.hasRole(bytes32(0), adminAddress);
    if (!hasAdminRole) {
      console2.log("ERROR: supplied key", adminAddress, "does not have DEFAULT_ADMIN_ROLE on XPRegistry.");
      console2.log("       Use the correct admin key or transfer the role before rerunning.");
      return;
    }
    (string memory existingName, address existingSigner, bool existingActive) = registry.games(gameId);
    if (bytes(existingName).length != 0) {
      console2.log("Game already registered:", gameId, existingName);
      console2.log("Current signer:", existingSigner);
      console2.log("Active:", existingActive);
      return;
    }

    vm.startBroadcast(adminKey);
    registry.registerGame(gameId, gameName, signer);
    vm.stopBroadcast();

    console2.log("Registered Greenvale game:");
    console2.log(" - Registry:", registryAddress);
    console2.log(" - Game ID:", gameId);
    console2.log(" - Name:", gameName);
    console2.log(" - Signer:", signer);
  }

  function _envAddress(string memory primary, string memory fallbackKey) private view returns (address) {
    try vm.envAddress(primary) returns (address value) {
      return value;
    } catch {
      return vm.envAddress(fallbackKey);
    }
  }

  function _envUint(string memory primary, string memory fallbackKey) private view returns (uint256) {
    try vm.envUint(primary) returns (uint256 value) {
      return value;
    } catch {
      return vm.envUint(fallbackKey);
    }
  }

  function _envString(string memory primary, string memory fallbackKey) private view returns (string memory) {
    try vm.envString(primary) returns (string memory value) {
      return value;
    } catch {
      return vm.envString(fallbackKey);
    }
  }
}
