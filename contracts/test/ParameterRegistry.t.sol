// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ParameterRegistry} from "../ParameterRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {SeedConfig, ShopItemConfig} from "../libs/Structs.sol";
import "../libs/Errors.sol";

contract ParameterRegistryTest is Test {
    ParameterRegistry internal registry;

    address internal admin = address(0xA11CE);
    address internal treasury = address(0xBEEF);
    address internal other = address(0xC0FFEE);

    uint16 internal constant MAX_PLOTS = 25;
    uint256 internal constant XP_LIMIT = 10_000 ether;

    function setUp() public {
        registry = _deployRegistry(admin, treasury, MAX_PLOTS, XP_LIMIT);
    }

    function testInitializeSetsState() public {
        assertEq(registry.treasury(), treasury);
        assertEq(registry.maxPlotsPerHarvest(), MAX_PLOTS);
        assertEq(registry.xpRateLimitPerTx(), XP_LIMIT);
        assertEq(registry.marketFeeBps(), 0);
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(registry.hasRole(registry.GAME_ADMIN_ROLE(), admin));
    }

    function testInitializeRevertsOnZeroAdmin() public {
        ParameterRegistry implementation = new ParameterRegistry();
        bytes memory initData = abi.encodeWithSelector(
            ParameterRegistry.initialize.selector,
            address(0),
            treasury,
            MAX_PLOTS,
            XP_LIMIT
        );
        vm.expectRevert(ZeroAddress.selector);
        new ERC1967Proxy(address(implementation), initData);
    }

    function testInitializeRevertsOnZeroTreasury() public {
        ParameterRegistry implementation = new ParameterRegistry();
        bytes memory initData = abi.encodeWithSelector(
            ParameterRegistry.initialize.selector,
            admin,
            address(0),
            MAX_PLOTS,
            XP_LIMIT
        );
        vm.expectRevert(ZeroAddress.selector);
        new ERC1967Proxy(address(implementation), initData);
    }

    function testInitializeRevertsOnZeroMaxPlots() public {
        ParameterRegistry implementation = new ParameterRegistry();
        bytes memory initData = abi.encodeWithSelector(
            ParameterRegistry.initialize.selector,
            admin,
            treasury,
            0,
            XP_LIMIT
        );
        vm.expectRevert(InvalidValue.selector);
        new ERC1967Proxy(address(implementation), initData);
    }

    function testInitializeRevertsOnZeroXpLimit() public {
        ParameterRegistry implementation = new ParameterRegistry();
        bytes memory initData = abi.encodeWithSelector(
            ParameterRegistry.initialize.selector,
            admin,
            treasury,
            MAX_PLOTS,
            0
        );
        vm.expectRevert(InvalidValue.selector);
        new ERC1967Proxy(address(implementation), initData);
    }

    function testGrantAndRevokeGameAdmin() public {
        address newAdmin = address(0x1234);
        vm.prank(admin);
        registry.grantGameAdmin(newAdmin);
        assertTrue(registry.hasRole(registry.GAME_ADMIN_ROLE(), newAdmin));

        vm.prank(admin);
        registry.revokeGameAdmin(newAdmin);
        assertFalse(registry.hasRole(registry.GAME_ADMIN_ROLE(), newAdmin));
    }

    function testGrantGameAdminRevertsOnZero() public {
        vm.prank(admin);
        vm.expectRevert(ZeroAddress.selector);
        registry.grantGameAdmin(address(0));
    }

    function testGrantGameAdminRevertsWhenCallerNotDefaultAdmin() public {
        vm.expectRevert();
        vm.prank(other);
        registry.grantGameAdmin(other);
    }

    function testSetSeedConfigAndGet() public {
        vm.prank(admin);
        registry.setSeedConfig(1, 200, 3600);

        SeedConfig memory cfg = registry.getSeedConfig(1);
        assertEq(cfg.baseExp, 200);
        assertEq(cfg.growthSeconds, 3600);
    }

    function testSetSeedConfigRevertsOnZeroValues() public {
        vm.prank(admin);
        vm.expectRevert(InvalidValue.selector);
        registry.setSeedConfig(1, 0, 3600);

        vm.prank(admin);
        vm.expectRevert(InvalidValue.selector);
        registry.setSeedConfig(1, 200, 0);
    }

    function testGetSeedConfigRevertsWhenNotConfigured() public {
        vm.expectRevert(abi.encodeWithSelector(InvalidSeedType.selector, 99));
        registry.getSeedConfig(99);
    }

    function testSetSeedConfigsBatch() public {
        uint256[] memory seedTypes = new uint256[](2);
        seedTypes[0] = 1;
        seedTypes[1] = 2;
        uint32[] memory baseExps = new uint32[](2);
        baseExps[0] = 100;
        baseExps[1] = 150;
        uint32[] memory growthSecs = new uint32[](2);
        growthSecs[0] = 3600;
        growthSecs[1] = 7200;

        vm.prank(admin);
        registry.setSeedConfigs(seedTypes, baseExps, growthSecs);

        SeedConfig memory cfg1 = registry.getSeedConfig(1);
        assertEq(cfg1.baseExp, 100);
        assertEq(cfg1.growthSeconds, 3600);

        SeedConfig memory cfg2 = registry.getSeedConfig(2);
        assertEq(cfg2.baseExp, 150);
        assertEq(cfg2.growthSeconds, 7200);
    }

    function testSetSeedConfigsBatchRevertsOnLengthMismatch() public {
        uint256[] memory seedTypes = new uint256[](1);
        seedTypes[0] = 1;
        uint32[] memory baseExps = new uint32[](2);
        baseExps[0] = 100;
        baseExps[1] = 101;
        uint32[] memory growthSecs = new uint32[](1);
        growthSecs[0] = 3600;

        vm.prank(admin);
        vm.expectRevert(LengthMismatch.selector);
        registry.setSeedConfigs(seedTypes, baseExps, growthSecs);
    }

    function testSetSeedConfigsBatchRevertsOnEmptyArray() public {
        uint256[] memory seedTypes = new uint256[](0);
        uint32[] memory baseExps = new uint32[](0);
        uint32[] memory growthSecs = new uint32[](0);

        vm.prank(admin);
        vm.expectRevert(InvalidValue.selector);
        registry.setSeedConfigs(seedTypes, baseExps, growthSecs);
    }

    function testSetToolSpeedBpsAndGet() public {
        vm.prank(admin);
        registry.setToolSpeedBps(0, 1000);

        assertEq(registry.getToolSpeedBps(0), 1000);
    }

    function testSetToolSpeedBpsRevertsWhenGreaterThanMax() public {
        vm.prank(admin);
        vm.expectRevert(InvalidValue.selector);
        registry.setToolSpeedBps(0, 10_001);
    }

    function testGetToolSpeedBpsRevertsWhenNotConfigured() public {
        vm.expectRevert(abi.encodeWithSelector(InvalidToolRarity.selector, 5));
        registry.getToolSpeedBps(5);
    }

    function testSetToolSpeedBpsBatch() public {
        uint256[] memory rarities = new uint256[](2);
        rarities[0] = 0;
        rarities[1] = 1;
        uint16[] memory speeds = new uint16[](2);
        speeds[0] = 500;
        speeds[1] = 1500;

        vm.prank(admin);
        registry.setToolSpeedBpsBatch(rarities, speeds);

        assertEq(registry.getToolSpeedBps(0), 500);
        assertEq(registry.getToolSpeedBps(1), 1500);
    }

    function testSetToolSpeedBpsBatchRevertsOnLengthMismatch() public {
        uint256[] memory rarities = new uint256[](1);
        rarities[0] = 0;
        uint16[] memory speeds = new uint16[](2);
        speeds[0] = 500;
        speeds[1] = 600;

        vm.prank(admin);
        vm.expectRevert(LengthMismatch.selector);
        registry.setToolSpeedBpsBatch(rarities, speeds);
    }

    function testSetToolSpeedBpsBatchRevertsOnEmptyArray() public {
        uint256[] memory rarities = new uint256[](0);
        uint16[] memory speeds = new uint16[](0);

        vm.prank(admin);
        vm.expectRevert(InvalidValue.selector);
        registry.setToolSpeedBpsBatch(rarities, speeds);
    }

    function testSetShopItemConfigAndGet() public {
        bytes32 key = keccak256("SEED_A");

        vm.prank(admin);
        registry.setShopItemConfig(key, 1 ether, true);

        ShopItemConfig memory cfg = registry.getShopItemConfig(key);
        assertEq(cfg.price, 1 ether);
        assertTrue(cfg.active);
    }

    function testSetShopItemConfigRevertsOnZeroKey() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(InvalidShopItem.selector, bytes32(0)));
        registry.setShopItemConfig(bytes32(0), 1 ether, true);
    }

    function testSetShopItemConfigRevertsOnActiveWithoutPrice() public {
        vm.prank(admin);
        vm.expectRevert(InvalidValue.selector);
        registry.setShopItemConfig(keccak256("SEED_A"), 0, true);
    }

    function testGetShopItemConfigRevertsWhenUnknown() public {
        vm.expectRevert(abi.encodeWithSelector(InvalidShopItem.selector, bytes32("UNKNOWN")));
        registry.getShopItemConfig(bytes32("UNKNOWN"));
    }

    function testSetShopItemConfigsBatch() public {
        bytes32[] memory keys = new bytes32[](2);
        keys[0] = keccak256("SEED_A");
        keys[1] = keccak256("SEED_B");

        uint128[] memory prices = new uint128[](2);
        prices[0] = 1 ether;
        prices[1] = 2 ether;

        bool[] memory actives = new bool[](2);
        actives[0] = true;
        actives[1] = false;

        vm.prank(admin);
        registry.setShopItemConfigs(keys, prices, actives);

        ShopItemConfig memory cfgA = registry.getShopItemConfig(keys[0]);
        assertEq(cfgA.price, 1 ether);
        assertTrue(cfgA.active);

        ShopItemConfig memory cfgB = registry.getShopItemConfig(keys[1]);
        assertEq(cfgB.price, 2 ether);
        assertFalse(cfgB.active);
    }

    function testSetShopItemConfigsBatchRevertsOnLengthMismatch() public {
        bytes32[] memory keys = new bytes32[](2);
        keys[0] = keccak256("SEED_A");
        keys[1] = keccak256("SEED_B");

        uint128[] memory prices = new uint128[](1);
        prices[0] = 1 ether;

        bool[] memory actives = new bool[](2);
        actives[0] = true;
        actives[1] = true;

        vm.prank(admin);
        vm.expectRevert(LengthMismatch.selector);
        registry.setShopItemConfigs(keys, prices, actives);
    }

    function testSetShopItemConfigsBatchRevertsOnEmptyArray() public {
        bytes32[] memory keys = new bytes32[](0);
        uint128[] memory prices = new uint128[](0);
        bool[] memory actives = new bool[](0);

        vm.prank(admin);
        vm.expectRevert(InvalidValue.selector);
        registry.setShopItemConfigs(keys, prices, actives);
    }

    function testSetMaxPlotsPerHarvest() public {
        vm.prank(admin);
        registry.setMaxPlotsPerHarvest(50);
        assertEq(registry.maxPlotsPerHarvest(), 50);
    }

    function testSetMaxPlotsPerHarvestRevertsOnZero() public {
        vm.prank(admin);
        vm.expectRevert(InvalidValue.selector);
        registry.setMaxPlotsPerHarvest(0);
    }

    function testSetSeasonBonusBps() public {
        vm.prank(admin);
        registry.setSeasonBonusBps(500);
        assertEq(registry.seasonBonusBps(), 500);
    }

    function testSetSeasonBonusBpsRevertsAboveMax() public {
        vm.prank(admin);
        vm.expectRevert(InvalidValue.selector);
        registry.setSeasonBonusBps(10_001);
    }

    function testSetXpRateLimitPerTx() public {
        vm.prank(admin);
        registry.setXpRateLimitPerTx(1234);
        assertEq(registry.xpRateLimitPerTx(), 1234);
    }

    function testSetXpRateLimitPerTxRevertsOnZero() public {
        vm.prank(admin);
        vm.expectRevert(InvalidValue.selector);
        registry.setXpRateLimitPerTx(0);
    }

    function testSetTreasury() public {
        address newTreasury = address(0xFEED);
        vm.prank(admin);
        registry.setTreasury(newTreasury);
        assertEq(registry.treasury(), newTreasury);
    }

    function testSetTreasuryRevertsOnZero() public {
        vm.prank(admin);
        vm.expectRevert(ZeroAddress.selector);
        registry.setTreasury(address(0));
    }

    function testSetTreasuryRevertsWhenCallerNotDefaultAdmin() public {
        vm.expectRevert();
        vm.prank(other);
        registry.setTreasury(other);
    }

    function testSetMarketplaceFeeBps() public {
        vm.prank(admin);
        registry.setMarketplaceFeeBps(250);
        assertEq(registry.marketFeeBps(), 250);
    }

    function testSetMarketplaceFeeBpsRevertsAboveMax() public {
        vm.prank(admin);
        vm.expectRevert(InvalidValue.selector);
        registry.setMarketplaceFeeBps(10_001);
    }

    function _deployRegistry(
        address admin_,
        address treasury_,
        uint16 maxPlots_,
        uint256 xpLimit_
    ) internal returns (ParameterRegistry) {
        ParameterRegistry implementation = new ParameterRegistry();
        bytes memory initData = abi.encodeWithSelector(
            ParameterRegistry.initialize.selector,
            admin_,
            treasury_,
            maxPlots_,
            xpLimit_
        );
        return ParameterRegistry(address(new ERC1967Proxy(address(implementation), initData)));
    }
}
