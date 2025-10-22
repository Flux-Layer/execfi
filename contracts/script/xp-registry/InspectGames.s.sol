// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {XPRegistry} from "../../src/xp-registry/XPRegistry.sol";

contract InspectGames is Script {
    function run() external view {
        address registryAddress = vm.envAddress("XP_REGISTRY_PROXY");
        XPRegistry registry = XPRegistry(registryAddress);

        for (uint256 gameId = 1; gameId <= 5; gameId++) {
            try registry.games(gameId) returns (string memory name, address signer, bool active) {
                if (bytes(name).length == 0) {
                    console2.log("Game", gameId, "not registered");
                } else {
                    console2.log("Game", gameId, name, signer, active);
                }
                uint256 limit = registry.maxAmountPerTx(gameId);
                console2.log("  rate limit:", limit);
            } catch {
                console2.log("Failed to read game", gameId);
            }
        }
    }
}
