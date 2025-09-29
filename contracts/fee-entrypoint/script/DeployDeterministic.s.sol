// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "../lib/forge-std/src/Script.sol";
import {console2 as console} from "../lib/forge-std/src/console2.sol";
import {FeeEntryPoint} from "../src/FeeEntryPoint.sol";
import {ERC1967Proxy} from "../lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";

interface IEIP2470Factory {
  function deploy(bytes memory initCode, bytes32 salt) external returns (address);
}

contract DeployDeterministic is Script {
  // If you have a different factory (e.g., Universal Deployer 0x4e59..),
  // change the interface/usage accordingly or pass address via env.

  function run() external {
    address factory = vm.envAddress("CREATE2_FACTORY");
    bytes32 salt = vm.envBytes32("SALT");
    address feeRecipient = vm.envAddress("FEE_RECIPIENT");
    uint256 feeBps = vm.envUint("FEE_BPS");
    bool fwd = vm.envBool("FORWARD_IMMEDIATELY");

    require(factory != address(0), "CREATE2_FACTORY required");
    require(feeRecipient != address(0), "FEE_RECIPIENT required");

    IEIP2470Factory f = IEIP2470Factory(factory);

    vm.startBroadcast();

    // 1) Deploy implementation deterministically
    bytes memory implCode = type(FeeEntryPoint).creationCode;
    address implementation = f.deploy(implCode, keccak256(abi.encodePacked(salt, bytes32("impl"))));
    console.log("Implementation:", implementation);

    // 2) Prepare init data
    bytes memory initData = abi.encodeCall(FeeEntryPoint.initialize, (feeRecipient, uint16(feeBps), fwd));

    // 3) Deploy proxy deterministically with (implementation, initData)
    bytes memory proxyCode = abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(implementation, initData));
    address proxy = f.deploy(proxyCode, keccak256(abi.encodePacked(salt, bytes32("proxy"))));
    console.log("Proxy:", proxy);

    vm.stopBroadcast();
  }
}

