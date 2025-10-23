// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {XPRegistry} from "../../src/xp-registry/XPRegistry.sol";

contract DeployXPRegistry is Script {
  function run() external returns (XPRegistry registry) {
    uint256 deployerKey = vm.envUint("PRIVATE_KEY");
    address admin = vm.addr(deployerKey);

    vm.startBroadcast(deployerKey);
    XPRegistry implementation = new XPRegistry();
    bytes memory initData = abi.encodeCall(XPRegistry.initialize, (admin));
    ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
    registry = XPRegistry(address(proxy));
    vm.stopBroadcast();

    console2.log("XPRegistry implementation:", address(implementation));
    console2.log("XPRegistry proxy:", address(registry));
    console2.log("EIP-712 domain separator:");
    console2.logBytes32(registry.domainSeparator());
  }
}
