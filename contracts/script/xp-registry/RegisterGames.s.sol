// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {XPRegistry} from "../../src/xp-registry/XPRegistry.sol";

contract RegisterGames is Script {
    struct GameConfig {
        uint256 id;
        string name;
        address signer;
        uint256 rateLimit;
    }

    function run() external {
        address registryAddress = vm.envAddress("XP_REGISTRY_PROXY");
        uint256 adminKey = vm.envUint("XP_REGISTRY_ADMIN_PRIVATE_KEY");
        XPRegistry registry = XPRegistry(registryAddress);

        GameConfig[] memory games = new GameConfig[](3);
        games[0] = GameConfig({
            id: _envUintOrDefault("DEGENSHOOT_GAME_ID", _envUintOrDefault("GAME_ID", 1)),
            name: _envStringOrDefault("DEGENSHOOT_GAME_NAME", "Degenshoot"),
            signer: _envAddressOrFallback("DEGENSHOOT_SIGNER_ADDRESS", "GAME_SIGNER_ADDRESS"),
            rateLimit: _envUintOrDefault("DEGENSHOOT_RATE_LIMIT", 0)
        });
        games[1] = GameConfig({
            id: _envUintOrDefault("COINFLIP_GAME_ID", 4),
            name: _envStringOrDefault("COINFLIP_GAME_NAME", "CoinFlip"),
            signer: _envAddressOrFallback("COINFLIP_SIGNER_ADDRESS", "GAME_SIGNER_ADDRESS"),
            rateLimit: _envUintOrDefault("COINFLIP_RATE_LIMIT", 0)
        });
        games[2] = GameConfig({
            id: _envUintOrDefault("MALLWARE_GAME_ID", 99),
            name: _envStringOrDefault("MALLWARE_GAME_NAME", "mallware"),
            signer: _envAddressOrFallback("MALLWARE_SIGNER_ADDRESS", "ADMIN_ADDRESS"),
            rateLimit: _envUintOrDefault("MALLWARE_RATE_LIMIT", 0)
        });

        vm.startBroadcast(adminKey);
        for (uint256 i = 0; i < games.length; i++) {
            _registerOrUpdate(registry, games[i]);
        }
        vm.stopBroadcast();
    }

    function _registerOrUpdate(XPRegistry registry, GameConfig memory game) private {
        (string memory existingName, address existingSigner, bool isActive) = registry.games(game.id);

        if (bytes(existingName).length == 0) {
            registry.registerGame(game.id, game.name, game.signer);
            console2.log("Registered game", game.id, game.name);
        } else {
            console2.log("Game already registered:", game.id, existingName);
            if (existingSigner != game.signer) {
                registry.setGameSigner(game.id, game.signer);
                console2.log(" - signer updated");
            }
            if (!isActive) {
                registry.setGameActive(game.id, true);
                console2.log(" - reactivated");
            }
        }

        uint256 currentLimit = registry.maxAmountPerTx(game.id);
        if (currentLimit != game.rateLimit) {
            registry.setGameRateLimit(game.id, game.rateLimit);
            console2.log(" - rate limit set:", game.rateLimit);
        }
    }

    function _envAddressOrFallback(string memory primary, string memory fallbackKey)
        private
        view
        returns (address)
    {
        try vm.envAddress(primary) returns (address value) {
            return value;
        } catch {
            if (bytes(fallbackKey).length == 0) revert("missing env address");
            try vm.envAddress(fallbackKey) returns (address fallbackValue) {
                return fallbackValue;
            } catch {
                revert(string.concat("missing env address for ", primary));
            }
        }
    }

    function _envUintOrDefault(string memory key, uint256 defaultValue) private view returns (uint256) {
        try vm.envUint(key) returns (uint256 value) {
            return value;
        } catch {
            return defaultValue;
        }
    }

    function _envStringOrDefault(string memory key, string memory defaultValue)
        private
        view
        returns (string memory)
    {
        try vm.envString(key) returns (string memory value) {
            return value;
        } catch {
            return defaultValue;
        }
    }
}
