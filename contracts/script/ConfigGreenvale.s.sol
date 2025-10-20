// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {ParameterRegistry} from "../ParameterRegistry.sol";
import {Item1155} from "../Item1155.sol";
import {Land721} from "../Land721.sol";
import {FarmingCore} from "../FarmingCore.sol";
import {Shop} from "../Shop.sol";

contract ConfigGreenvale is Script {
    struct Addresses {
        ParameterRegistry parameterRegistry;
        Item1155 item1155;
        Land721 land721;
        FarmingCore farmingCore;
        Shop shop;
        address treasury;
        address manager;
    }

    struct SeedInit {
        uint256 seedType;
        uint32 baseExp;
        uint32 growthSeconds;
        uint128 priceWei;
    }

    struct ToolInit {
        uint256 rarity;
        uint16 speedBps;
        uint128 priceWei;
    }

    bytes32 private constant DEFAULT_ADMIN = 0x00;
    bytes32 private constant WATER_KEY = keccak256("SHOP_WATER");
    bytes32 private constant LAND_KEY = keccak256("SHOP_LAND");

    uint16 private constant MAX_PLOTS_PER_HARVEST = 12;
    uint256 private constant XP_RATE_LIMIT_PER_TX = 1_200;
    uint16 private constant SEASON_BONUS_BPS = 1_000;
    uint16 private constant MARKET_FEE_BPS = 250;

    uint128 private constant WATER_PRICE_WEI = 100_000_000_000_000;
    uint128 private constant LAND_PRICE_WEI = 2_000_000_000_000_000;

    function run() external {
        uint256 operatorKey = vm.envUint("GREENVALE_OPERATOR_PRIVATE_KEY");

        Addresses memory addrs = Addresses({
            parameterRegistry: ParameterRegistry(vm.envAddress("PARAMETER_REGISTRY_PROXY")),
            item1155: Item1155(vm.envAddress("ITEM1155_PROXY")),
            land721: Land721(vm.envAddress("LAND721_PROXY")),
            farmingCore: FarmingCore(vm.envAddress("FARMING_CORE_PROXY")),
            shop: Shop(payable(vm.envAddress("SHOP_PROXY"))),
            treasury: vm.envAddress("GREENVALE_TREASURY_ADDRESS"),
            manager: vm.envAddress("GREENVALE_MANAGER_ADDRESS")
        });

        vm.startBroadcast(operatorKey);

        _applyConfiguration(addrs);

        vm.stopBroadcast();

        console2.log("Greenvale configuration applied:");
        console2.log(" - ParameterRegistry:", address(addrs.parameterRegistry));
        console2.log(" - Item1155:", address(addrs.item1155));
        console2.log(" - Land721:", address(addrs.land721));
        console2.log(" - FarmingCore:", address(addrs.farmingCore));
        console2.log(" - Shop:", address(addrs.shop));
    }

    function configure(Addresses memory addrs) public {
        _applyConfiguration(addrs);
    }

    function _applyConfiguration(Addresses memory addrs) internal {
        ParameterRegistry parameterRegistry = addrs.parameterRegistry;
        Item1155 item1155 = addrs.item1155;
        Land721 land721 = addrs.land721;
        FarmingCore farmingCore = addrs.farmingCore;
        Shop shop = addrs.shop;
        address treasury = addrs.treasury;
        address manager = addrs.manager;

        parameterRegistry.setMaxPlotsPerHarvest(MAX_PLOTS_PER_HARVEST);
        parameterRegistry.setXpRateLimitPerTx(XP_RATE_LIMIT_PER_TX);
        parameterRegistry.setSeasonBonusBps(SEASON_BONUS_BPS);
        parameterRegistry.setMarketplaceFeeBps(MARKET_FEE_BPS);
        parameterRegistry.setTreasury(treasury);

        SeedInit[] memory seeds = new SeedInit[](3);
        seeds[0] = SeedInit({seedType: 100, baseExp: 30, growthSeconds: 3_600, priceWei: 100_000_000_000_000});
        seeds[1] = SeedInit({seedType: 101, baseExp: 70, growthSeconds: 7_200, priceWei: 200_000_000_000_000});
        seeds[2] = SeedInit({seedType: 102, baseExp: 150, growthSeconds: 14_400, priceWei: 350_000_000_000_000});

        for (uint256 i; i < seeds.length; ++i) {
            parameterRegistry.setSeedConfig(seeds[i].seedType, seeds[i].baseExp, seeds[i].growthSeconds);
            bytes32 itemKey = _seedItemKey(seeds[i].seedType);
            parameterRegistry.setShopItemConfig(itemKey, seeds[i].priceWei, true);
        }

        ToolInit[] memory tools = new ToolInit[](3);
        tools[0] = ToolInit({rarity: 1, speedBps: 0, priceWei: 1_000_000_000_000_000});
        tools[1] = ToolInit({rarity: 2, speedBps: 5_000, priceWei: 1_500_000_000_000_000});
        tools[2] = ToolInit({rarity: 3, speedBps: 10_000, priceWei: 2_000_000_000_000_000});

        for (uint256 i; i < tools.length; ++i) {
            parameterRegistry.setToolSpeedBps(tools[i].rarity, tools[i].speedBps);
            bytes32 itemKey = _toolItemKey(tools[i].rarity);
            parameterRegistry.setShopItemConfig(itemKey, tools[i].priceWei, true);
        }

        parameterRegistry.setShopItemConfig(WATER_KEY, WATER_PRICE_WEI, true);
        parameterRegistry.setShopItemConfig(LAND_KEY, LAND_PRICE_WEI, true);

        item1155.grantRole(item1155.MINTER_ROLE(), address(shop));
        item1155.grantRole(item1155.BURNER_ROLE(), address(farmingCore));
        land721.grantRole(land721.MINTER_ROLE(), address(shop));

        if (manager != address(0)) {
            farmingCore.grantRole(farmingCore.MANAGER_ROLE(), manager);
            item1155.grantRole(item1155.MINTER_ROLE(), manager);
            item1155.grantRole(item1155.BURNER_ROLE(), manager);
            land721.grantRole(land721.MINTER_ROLE(), manager);
            shop.grantRole(DEFAULT_ADMIN, manager);
        }
    }

    function _seedItemKey(uint256 seedType) private pure returns (bytes32) {
        return keccak256(abi.encodePacked("SHOP_SEED", seedType));
    }

    function _toolItemKey(uint256 toolRarity) private pure returns (bytes32) {
        return keccak256(abi.encodePacked("SHOP_TOOL", toolRarity));
    }
}
