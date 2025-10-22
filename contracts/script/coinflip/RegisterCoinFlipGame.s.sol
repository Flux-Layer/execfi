// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {XPRegistry} from "../../src/xp-registry/XPRegistry.sol";

contract RegisterCoinFlipGame is Script {
    bytes32 private constant DEFAULT_ADMIN_ROLE = bytes32(0);

    function run() external {
        address registryAddress = _envAddress("COINFLIP_REGISTRY_PROXY", "XP_REGISTRY_PROXY");
        uint256 adminKey = _envUint("COINFLIP_REGISTRY_ADMIN_KEY", "XP_REGISTRY_ADMIN_PRIVATE_KEY");
        uint256 gameId = _envUint("COINFLIP_GAME_ID", "GAME_ID");
        string memory gameName = _envString("COINFLIP_GAME_NAME", "COINFLIP_DEFAULT_NAME");
        address signer = _envAddress("COINFLIP_SIGNER_ADDRESS", "GAME_SIGNER_ADDRESS");

        require(bytes(gameName).length > 0, "CoinFlip game name not configured");

        XPRegistry registry = XPRegistry(registryAddress);
        address adminAddress = vm.addr(adminKey);

        if (!registry.hasRole(DEFAULT_ADMIN_ROLE, adminAddress)) {
            console2.log("ERROR: supplied key", adminAddress, "does not have DEFAULT_ADMIN_ROLE on XPRegistry.");
            return;
        }

        (string memory existingName, address existingSigner, bool isActive) = registry.games(gameId);
        if (bytes(existingName).length != 0) {
            console2.log("Game already registered:", gameId, existingName);
            console2.log("Current signer:", existingSigner);
            console2.log("Active:", isActive);
            return;
        }

        vm.startBroadcast(adminKey);
        registry.registerGame(gameId, gameName, signer);
        vm.stopBroadcast();

        console2.log("Registered CoinFlip game:");
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
