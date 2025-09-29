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

  function _hasCode(address a) internal view returns (bool) {
    return a.code.length > 0;
  }

  function _computeCreate2(
    address factory,
    bytes32 salt,
    bytes memory initCode
  ) internal pure returns (address predicted) {
    bytes32 initCodeHash = keccak256(initCode);
    bytes32 hash = keccak256(
      abi.encodePacked(bytes1(0xff), factory, salt, initCodeHash)
    );
    predicted = address(uint160(uint256(hash)));
  }

  function run() external {
    address factory = vm.envAddress("CREATE2_FACTORY");

    // Flexible SALT handling: try bytes32 first, else hash string SALT
    bytes32 salt;
    try vm.envBytes32("SALT") returns (bytes32 s) {
      salt = s;
      console.log("Using raw bytes32 SALT");
    } catch {
      string memory saltStr = vm.envString("SALT");
      salt = keccak256(bytes(saltStr));
      console.log("Using keccak256(SALT string)");
    }

    address feeRecipient = vm.envAddress("FEE_RECIPIENT");
    uint256 feeBps = vm.envUint("FEE_BPS");
    bool fwd = vm.envBool("FORWARD_IMMEDIATELY");

    require(factory != address(0), "CREATE2_FACTORY required");
    require(feeRecipient != address(0), "FEE_RECIPIENT required");

    require(factory != address(0), "CREATE2_FACTORY required");
    require(_hasCode(factory), "CREATE2 factory not deployed on target chain");
    IEIP2470Factory f = IEIP2470Factory(factory);

    vm.startBroadcast();

    // 1) Deploy (or reuse) implementation deterministically
    bytes memory implCode = type(FeeEntryPoint).creationCode;
    bytes32 implSalt = keccak256(abi.encodePacked(salt, bytes32("impl")));
    address predictedImpl = _computeCreate2(factory, implSalt, implCode);
    console.log("Predicted Implementation:", predictedImpl);
    address implementation;
    if (_hasCode(predictedImpl)) {
      console.log("Implementation already deployed, reusing existing address");
      implementation = predictedImpl;
    } else {
      implementation = f.deploy(implCode, implSalt);
      require(implementation != address(0), "Implementation deploy returned zero address");
    }
    console.log("Implementation:", implementation);

    // 2) Prepare init data
    bytes memory initData = abi.encodeCall(FeeEntryPoint.initialize, (feeRecipient, uint16(feeBps), fwd));

    // 3) Deploy (or reuse) proxy deterministically with (implementation, initData)
    bytes memory proxyCode = abi.encodePacked(type(ERC1967Proxy).creationCode, abi.encode(implementation, initData));
    bytes32 proxySalt = keccak256(abi.encodePacked(salt, bytes32("proxy")));
    address predictedProxy = _computeCreate2(factory, proxySalt, proxyCode);
    console.log("Predicted Proxy:", predictedProxy);
    address proxy;
    if (_hasCode(predictedProxy)) {
      console.log("Proxy already deployed, reusing existing address");
      proxy = predictedProxy;
    } else {
      proxy = f.deploy(proxyCode, proxySalt);
      require(proxy != address(0), "Proxy deploy returned zero address");
    }
    console.log("Proxy:", proxy);

    vm.stopBroadcast();
  }
}
