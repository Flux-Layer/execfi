// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {ParameterRegistry} from "../ParameterRegistry.sol";
import {Item1155} from "../Item1155.sol";
import {Land721} from "../Land721.sol";
import {Shop} from "../Shop.sol";
import {Marketplace} from "../Marketplace.sol";
import {FarmingCore} from "../FarmingCore.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployGreenvale is Script {
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

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address admin = vm.envAddress("GREENVALE_ADMIN_ADDRESS");
        address treasury = vm.envAddress("GREENVALE_TREASURY_ADDRESS");
        address xpRegistry = vm.envAddress("XP_REGISTRY_PROXY");
        uint256 gameId = vm.envUint("FARMING_GAME_ID");
        uint16 maxPlotsPerHarvest = uint16(vm.envUint("FARMING_MAX_PLOTS_PER_HARVEST"));
        uint256 xpRateLimitPerTx = vm.envUint("FARMING_XP_RATE_LIMIT");
        uint16 marketplaceFeeBps = uint16(vm.envUint("MARKETPLACE_FEE_BPS"));
        string memory item1155BaseUri = vm.envString("ITEM1155_BASE_URI");
        string memory landName = vm.envString("LAND_NAME");
        string memory landSymbol = vm.envString("LAND_SYMBOL");
        string memory landBaseUri = vm.envString("LAND_BASE_URI");

        vm.startBroadcast(deployerKey);

        // 1. Deploy ParameterRegistry
        ParameterRegistry parameterRegistryImpl = new ParameterRegistry();
        bytes memory parameterInit = abi.encodeWithSelector(
            ParameterRegistry.initialize.selector,
            admin,
            treasury,
            maxPlotsPerHarvest,
            xpRateLimitPerTx
        );
        ParameterRegistry parameterRegistry = ParameterRegistry(
            address(new ERC1967Proxy(address(parameterRegistryImpl), parameterInit))
        );

        // 2. Deploy Item1155 & Land721
        Item1155 item1155Impl = new Item1155();
        bytes memory itemInit = abi.encodeWithSelector(Item1155.initialize.selector, admin, item1155BaseUri);
        Item1155 item1155 = Item1155(address(new ERC1967Proxy(address(item1155Impl), itemInit)));

        Land721 land721Impl = new Land721();
        bytes memory landInit = abi.encodeWithSelector(
            Land721.initialize.selector,
            admin,
            landName,
            landSymbol,
            landBaseUri
        );
        Land721 land721 = Land721(address(new ERC1967Proxy(address(land721Impl), landInit)));

        // 3. Deploy Shop & Marketplace
        Shop shopImpl = new Shop();
        bytes memory shopInit = abi.encodeWithSelector(
            Shop.initialize.selector,
            admin,
            address(parameterRegistry),
            address(item1155),
            address(land721)
        );
        Shop shop = Shop(payable(address(new ERC1967Proxy(address(shopImpl), shopInit))));

        Marketplace marketplaceImpl = new Marketplace();
        bytes memory marketInit = abi.encodeWithSelector(
            Marketplace.initialize.selector,
            admin,
            address(parameterRegistry),
            address(item1155),
            address(land721)
        );
        Marketplace marketplace =
            Marketplace(payable(address(new ERC1967Proxy(address(marketplaceImpl), marketInit))));

        // 4. Deploy FarmingCore
        FarmingCore farmingCoreImpl = new FarmingCore();
        bytes memory farmingInit = abi.encodeWithSelector(
            FarmingCore.initialize.selector,
            admin,
            address(parameterRegistry),
            address(item1155),
            address(land721),
            xpRegistry,
            gameId
        );
        FarmingCore farmingCore = FarmingCore(address(new ERC1967Proxy(address(farmingCoreImpl), farmingInit)));

        // 5. Grant roles
        item1155.grantRole(item1155.MINTER_ROLE(), address(shop));
        item1155.grantRole(item1155.BURNER_ROLE(), address(farmingCore));
        land721.grantRole(land721.MINTER_ROLE(), address(shop));

        // 6. Configure ParameterRegistry seeds & tools
        SeedInit[2] memory seeds = [
            SeedInit({seedType: 1, baseExp: 100, growthSeconds: 3600, priceWei: uint128(0.01 ether)}),
            SeedInit({seedType: 2, baseExp: 180, growthSeconds: 5400, priceWei: uint128(0.015 ether)})
        ];

        for (uint256 i; i < seeds.length; ++i) {
            parameterRegistry.setSeedConfig(seeds[i].seedType, seeds[i].baseExp, seeds[i].growthSeconds);
            bytes32 seedKey = keccak256(abi.encodePacked("SHOP_SEED", seeds[i].seedType));
            parameterRegistry.setShopItemConfig(seedKey, seeds[i].priceWei, true);
        }

        ToolInit[3] memory tools = [
            ToolInit({rarity: 1, speedBps: 0, priceWei: uint128(0.02 ether)}),
            ToolInit({rarity: 2, speedBps: 500, priceWei: uint128(0.05 ether)}),
            ToolInit({rarity: 3, speedBps: 1500, priceWei: uint128(0.12 ether)})
        ];

        for (uint256 i; i < tools.length; ++i) {
            parameterRegistry.setToolSpeedBps(tools[i].rarity, tools[i].speedBps);
            bytes32 toolKey = keccak256(abi.encodePacked("SHOP_TOOL", tools[i].rarity));
            parameterRegistry.setShopItemConfig(toolKey, tools[i].priceWei, true);
        }

        // Configure water & land pricing in shop
        parameterRegistry.setShopItemConfig(keccak256("SHOP_WATER"), uint128(0.001 ether), true);
        parameterRegistry.setShopItemConfig(keccak256("SHOP_LAND"), uint128(0.1 ether), true);

        // Marketplace fee (treasury already set during initialization)
        parameterRegistry.setMarketplaceFeeBps(marketplaceFeeBps);

        vm.stopBroadcast();

        console2.log("ParameterRegistry deployed:", address(parameterRegistry));
        console2.log("Item1155 deployed:", address(item1155));
        console2.log("Land721 deployed:", address(land721));
        console2.log("Shop deployed:", address(shop));
        console2.log("Marketplace deployed:", address(marketplace));
        console2.log("FarmingCore deployed:", address(farmingCore));
        console2.log("Remember to update .env with the addresses above and set actual IPFS URIs / additional configs as needed.");
    }
}
