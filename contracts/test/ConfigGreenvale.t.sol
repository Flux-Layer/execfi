// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {ConfigGreenvale} from "../script/ConfigGreenvale.s.sol";
import {ParameterRegistry} from "../ParameterRegistry.sol";
import {Item1155} from "../Item1155.sol";
import {Land721} from "../Land721.sol";
import {Shop} from "../Shop.sol";
import {FarmingCore} from "../FarmingCore.sol";
import {IXPRegistry} from "../interfaces/IXPRegistry.sol";
import {SeedConfig, ShopItemConfig} from "../libs/Structs.sol";

contract MockXPRegistry is IXPRegistry {
    mapping(address => mapping(uint256 => uint256)) public nonces;

    function addXpWithSig(
        address user,
        uint256 gameId,
        uint256 amount,
        uint256 /* deadline */,
        bytes calldata /* signature */
    ) external override {
        nonces[user][gameId] += amount;
    }

    function getNonce(address account, uint256 gameId) external view override returns (uint256) {
        return nonces[account][gameId];
    }

    function domainSeparator() external pure override returns (bytes32) {
        return bytes32("mock");
    }
}

contract ConfigGreenvaleScriptTest is Test {
    address internal constant INITIAL_TREASURY = address(0xFEE);
    uint256 internal constant GAME_ID = 42;

    ParameterRegistry internal registry;
    Item1155 internal item1155;
    Land721 internal land721;
    Shop internal shop;
    FarmingCore internal farmingCore;
    MockXPRegistry internal xpRegistry;
    ConfigGreenvale internal configScript;

    function setUp() public {
        registry = _deployRegistry(address(this), INITIAL_TREASURY);
        item1155 = _deployItem1155(address(this));
        land721 = _deployLand(address(this));
        shop = _deployShop(address(this), address(registry), address(item1155), address(land721));

        xpRegistry = new MockXPRegistry();
        farmingCore = _deployFarmingCore(
            address(this),
            address(registry),
            address(item1155),
            address(land721),
            address(xpRegistry),
            GAME_ID
        );

        configScript = new ConfigGreenvale();

        _grantScriptRoles(address(configScript));
    }

    function testConfigureAppliesDataset() public {
        address treasury = address(0xC0FFEE);
        address manager = address(0x1234);

        ConfigGreenvale.Addresses memory addrs = _buildAddresses(treasury, manager);

        configScript.configure(addrs);

        assertEq(registry.maxPlotsPerHarvest(), 12);
        assertEq(registry.xpRateLimitPerTx(), 1_200);
        assertEq(registry.seasonBonusBps(), 1_000);
        assertEq(registry.marketFeeBps(), 250);
        assertEq(registry.treasury(), treasury);

        _assertSeedConfig(100, 30, 3_600, 100_000_000_000_000);
        _assertSeedConfig(101, 70, 7_200, 200_000_000_000_000);
        _assertSeedConfig(102, 150, 14_400, 350_000_000_000_000);

        _assertToolConfig(1, 0, 1_000_000_000_000_000);
        _assertToolConfig(2, 5_000, 1_500_000_000_000_000);
        _assertToolConfig(3, 10_000, 2_000_000_000_000_000);

        ShopItemConfig memory waterConfig = registry.getShopItemConfig(keccak256("SHOP_WATER"));
        assertEq(waterConfig.price, 100_000_000_000_000);
        assertTrue(waterConfig.active);

        ShopItemConfig memory landConfig = registry.getShopItemConfig(keccak256("SHOP_LAND"));
        assertEq(landConfig.price, 2_000_000_000_000_000);
        assertTrue(landConfig.active);

        assertTrue(item1155.hasRole(item1155.MINTER_ROLE(), address(shop)));
        assertTrue(item1155.hasRole(item1155.BURNER_ROLE(), address(farmingCore)));
        assertTrue(land721.hasRole(land721.MINTER_ROLE(), address(shop)));

        assertTrue(farmingCore.hasRole(farmingCore.MANAGER_ROLE(), manager));
        assertTrue(item1155.hasRole(item1155.MINTER_ROLE(), manager));
        assertTrue(item1155.hasRole(item1155.BURNER_ROLE(), manager));
        assertTrue(land721.hasRole(land721.MINTER_ROLE(), manager));
        assertTrue(shop.hasRole(shop.DEFAULT_ADMIN_ROLE(), manager));
    }

    function testConfigureSkipsManagerWhenZeroAddress() public {
        ConfigGreenvale.Addresses memory addrs = _buildAddresses(address(0xCAFED00D), address(0));
        configScript.configure(addrs);

        assertFalse(farmingCore.hasRole(farmingCore.MANAGER_ROLE(), address(0)));
        assertFalse(item1155.hasRole(item1155.MINTER_ROLE(), address(0)));
        assertFalse(item1155.hasRole(item1155.BURNER_ROLE(), address(0)));
        assertFalse(land721.hasRole(land721.MINTER_ROLE(), address(0)));
        assertFalse(shop.hasRole(shop.DEFAULT_ADMIN_ROLE(), address(0)));
    }

    function _assertSeedConfig(
        uint256 seedType,
        uint32 expectedExp,
        uint32 expectedGrowth,
        uint128 expectedPrice
    ) internal {
        SeedConfig memory cfg = registry.getSeedConfig(seedType);
        assertEq(cfg.baseExp, expectedExp);
        assertEq(cfg.growthSeconds, expectedGrowth);

        bytes32 key = keccak256(abi.encodePacked("SHOP_SEED", seedType));
        ShopItemConfig memory itemCfg = registry.getShopItemConfig(key);
        assertEq(itemCfg.price, expectedPrice);
        assertTrue(itemCfg.active);
    }

    function _assertToolConfig(
        uint256 rarity,
        uint16 expectedSpeedBps,
        uint128 expectedPrice
    ) internal {
        assertEq(registry.getToolSpeedBps(rarity), expectedSpeedBps);

        bytes32 key = keccak256(abi.encodePacked("SHOP_TOOL", rarity));
        ShopItemConfig memory itemCfg = registry.getShopItemConfig(key);
        assertEq(itemCfg.price, expectedPrice);
        assertTrue(itemCfg.active);
    }

    function _buildAddresses(address treasury, address manager) internal view returns (ConfigGreenvale.Addresses memory) {
        return ConfigGreenvale.Addresses({
            parameterRegistry: registry,
            item1155: item1155,
            land721: land721,
            farmingCore: farmingCore,
            shop: shop,
            treasury: treasury,
            manager: manager
        });
    }

    function _grantScriptRoles(address scriptAddr) internal {
        registry.grantRole(registry.DEFAULT_ADMIN_ROLE(), scriptAddr);
        registry.grantRole(registry.GAME_ADMIN_ROLE(), scriptAddr);

        item1155.grantRole(item1155.DEFAULT_ADMIN_ROLE(), scriptAddr);
        land721.grantRole(land721.DEFAULT_ADMIN_ROLE(), scriptAddr);
        shop.grantRole(shop.DEFAULT_ADMIN_ROLE(), scriptAddr);
        farmingCore.grantRole(farmingCore.DEFAULT_ADMIN_ROLE(), scriptAddr);
    }

    function _deployRegistry(address admin_, address treasury_) internal returns (ParameterRegistry) {
        ParameterRegistry implementation = new ParameterRegistry();
        bytes memory initData = abi.encodeWithSelector(
            ParameterRegistry.initialize.selector,
            admin_,
            treasury_,
            uint16(6),
            uint256(1000)
        );
        return ParameterRegistry(address(new ERC1967Proxy(address(implementation), initData)));
    }

    function _deployItem1155(address admin_) internal returns (Item1155) {
        Item1155 implementation = new Item1155();
        bytes memory initData =
            abi.encodeWithSelector(Item1155.initialize.selector, admin_, "ipfs://items/{id}.json");
        return Item1155(address(new ERC1967Proxy(address(implementation), initData)));
    }

    function _deployLand(address admin_) internal returns (Land721) {
        Land721 implementation = new Land721();
        bytes memory initData = abi.encodeWithSelector(
            Land721.initialize.selector,
            admin_,
            "Greenvale Land",
            "GVLAND",
            "ipfs://land/"
        );
        return Land721(address(new ERC1967Proxy(address(implementation), initData)));
    }

    function _deployShop(
        address admin_,
        address registry_,
        address item1155_,
        address land721_
    ) internal returns (Shop) {
        Shop implementation = new Shop();
        bytes memory initData = abi.encodeWithSelector(
            Shop.initialize.selector,
            admin_,
            registry_,
            item1155_,
            land721_
        );
        return Shop(payable(address(new ERC1967Proxy(address(implementation), initData))));
    }

    function _deployFarmingCore(
        address admin_,
        address registry_,
        address items_,
        address lands_,
        address xpRegistry_,
        uint256 gameId_
    ) internal returns (FarmingCore) {
        FarmingCore implementation = new FarmingCore();
        bytes memory initData = abi.encodeWithSelector(
            FarmingCore.initialize.selector,
            admin_,
            registry_,
            items_,
            lands_,
            xpRegistry_,
            gameId_
        );
        return FarmingCore(payable(address(new ERC1967Proxy(address(implementation), initData))));
    }
}
