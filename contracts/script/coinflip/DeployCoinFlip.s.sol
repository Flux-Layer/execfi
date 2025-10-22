// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CoinFlipGame} from "../../src/coinflip/CoinFlipGame.sol";
import {CoinFlipVault} from "../../src/coinflip/CoinFlipVault.sol";

contract DeployCoinFlip is Script {
    function run() external {
        uint256 deployerKey = _envUint("COINFLIP_DEPLOYER_KEY", "PRIVATE_KEY");
        address admin = _envAddress("COINFLIP_ADMIN_ADDRESS", "ADMIN_ADDRESS");
        address gameSigner = _envAddress("COINFLIP_SIGNER_ADDRESS", "GAME_SIGNER_ADDRESS");
        address registryProxy = _envAddress("COINFLIP_REGISTRY_PROXY", "XP_REGISTRY_PROXY");
        uint256 gameId = _envUint("COINFLIP_GAME_ID", "GAME_ID");
        address treasury = _envAddress("COINFLIP_TREASURY_ADDRESS", "TREASURY_ADDRESS");
        uint16 houseFeeBps = uint16(_envUint("COINFLIP_HOUSE_FEE_BPS", "HOUSE_FEE_BPS"));

        vm.startBroadcast(deployerKey);

        CoinFlipGame game = new CoinFlipGame(admin, gameSigner, registryProxy, gameId);
        CoinFlipVault vault = new CoinFlipVault(admin, address(game), treasury, houseFeeBps);
        game.setVault(address(vault));

        vm.stopBroadcast();

        console2.log("CoinFlipGame deployed:", address(game));
        console2.log("CoinFlip domain separator:");
        console2.logBytes32(game.domainSeparator());
        console2.log("CoinFlipVault deployed:", address(vault));
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
}
