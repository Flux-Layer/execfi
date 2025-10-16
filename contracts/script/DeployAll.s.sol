// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Degenshoot} from "../degenshoot/Degenshoot.sol";
import {WagerVault} from "../vault/WagerVault.sol";

contract DeployAll is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address gameSigner = vm.envAddress("GAME_SIGNER_ADDRESS");
        address registryProxy = vm.envAddress("XP_REGISTRY_PROXY");
        uint256 gameId = vm.envUint("GAME_ID");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        uint16 houseFeeBps = uint16(vm.envUint("HOUSE_FEE_BPS"));

        vm.startBroadcast(deployerKey);

        Degenshoot degenshoot = new Degenshoot(admin, gameSigner, registryProxy, gameId);
        WagerVault vault = new WagerVault(admin, address(degenshoot), treasury, houseFeeBps);
        degenshoot.setWagerVault(address(vault));

        vm.stopBroadcast();

        console2.log("Degenshoot deployed:", address(degenshoot));
        console2.log("Degenshoot domain separator:");
        console2.logBytes32(degenshoot.domainSeparator());
        console2.log("WagerVault deployed:", address(vault));
    }
}
