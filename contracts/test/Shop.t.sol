// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Shop} from "../Shop.sol";
import {ParameterRegistry} from "../ParameterRegistry.sol";
import {Item1155} from "../Item1155.sol";
import {Land721} from "../Land721.sol";
import "../libs/Errors.sol";

contract ShopTest is Test {
    address internal admin = address(0xA11CE);
    address internal user = address(0xBEEF);

    ParameterRegistry internal registry;
    Item1155 internal items;
    Land721 internal lands;
    Shop internal shop;

    bytes32 internal constant SEED_KEY = keccak256(abi.encodePacked("SHOP_SEED", uint256(1)));
    bytes32 internal constant TOOL_KEY = keccak256(abi.encodePacked("SHOP_TOOL", uint256(2)));
    bytes32 internal constant WATER_KEY = keccak256("SHOP_WATER");
    bytes32 internal constant LAND_KEY = keccak256("SHOP_LAND");

    function setUp() public {
        registry = _deployRegistry(admin);
        items = _deployItem1155(admin);
        lands = _deployLand(admin);
        shop = _deployShop(admin, address(registry), address(items), address(lands));

        vm.startPrank(admin);
        registry.setShopItemConfig(SEED_KEY, 0.01 ether, true);
        registry.setShopItemConfig(TOOL_KEY, 0.05 ether, true);
        registry.setShopItemConfig(WATER_KEY, 0.001 ether, true);
        registry.setShopItemConfig(LAND_KEY, 0.1 ether, true);
        items.grantRole(items.MINTER_ROLE(), address(shop));
        lands.grantRole(lands.MINTER_ROLE(), address(shop));
        vm.stopPrank();
    }

    function testBuySeedMintsItem() public {
        vm.deal(user, 1 ether);
        vm.prank(user);
        shop.buySeed{value: 0.03 ether}(1, 3);

        uint256 tokenId = 200_000 + 1;
        assertEq(items.balanceOf(user, tokenId), 3);
        assertEq(address(registry.treasury()).balance, 0.03 ether);
    }

    function testBuyToolMintsItem() public {
        vm.deal(user, 1 ether);
        vm.prank(user);
        shop.buyTool{value: 0.1 ether}(2, 2);

        uint256 tokenId = 100_000 + 2;
        assertEq(items.balanceOf(user, tokenId), 2);
    }

    function testBuyWaterMintsItem() public {
        vm.deal(user, 1 ether);
        vm.prank(user);
        shop.buyWater{value: 0.005 ether}(5);

        assertEq(items.balanceOf(user, 300_000), 5);
    }

    function testBuyLandMintsPlots() public {
        vm.deal(user, 1 ether);
        vm.prank(user);
        shop.buyLand{value: 0.2 ether}(2);

        assertEq(lands.balanceOf(user), 2);
        assertEq(lands.ownerOf(1), user);
        assertEq(lands.ownerOf(2), user);
    }

    function testBuyLandRespectsLimit() public {
        vm.deal(user, 1 ether);
        vm.prank(user);
        shop.buyLand{value: 0.4 ether}(4);

        vm.deal(user, 1 ether);
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(LandLimitReached.selector, user));
        shop.buyLand{value: 0.1 ether}(1);
    }

    function testBuySeedRevertsOnInactiveItem() public {
        vm.prank(admin);
        registry.setShopItemConfig(SEED_KEY, 0.01 ether, false);

        vm.deal(user, 1 ether);
        vm.prank(user);
        vm.expectRevert(Unauthorized.selector);
        shop.buySeed{value: 0.01 ether}(1, 1);
    }

    function testBuySeedRevertsOnWrongPayment() public {
        vm.deal(user, 1 ether);
        vm.prank(user);
        vm.expectRevert(InvalidValue.selector);
        shop.buySeed{value: 0.01 ether}(1, 2);
    }

    function testPauseBlocksPurchases() public {
        vm.prank(admin);
        shop.pause();

        vm.deal(user, 1 ether);
        vm.prank(user);
        vm.expectRevert(bytes4(keccak256("EnforcedPause()")));
        shop.buySeed{value: 0.01 ether}(1, 1);
    }

    function _deployRegistry(address admin_) internal returns (ParameterRegistry) {
        ParameterRegistry implementation = new ParameterRegistry();
        bytes memory initData = abi.encodeWithSelector(
            ParameterRegistry.initialize.selector,
            admin_,
            admin_,
            uint16(25),
            uint256(1_000 ether)
        );
        return ParameterRegistry(address(new ERC1967Proxy(address(implementation), initData)));
    }

    function _deployItem1155(address admin_) internal returns (Item1155) {
        Item1155 implementation = new Item1155();
        bytes memory initData = abi.encodeWithSelector(Item1155.initialize.selector, admin_, "https://example.com/items/{id}.json");
        return Item1155(address(new ERC1967Proxy(address(implementation), initData)));
    }

    function _deployLand(address admin_) internal returns (Land721) {
        Land721 implementation = new Land721();
        bytes memory initData = abi.encodeWithSelector(
            Land721.initialize.selector,
            admin_,
            "Land",
            "LAND",
            "https://example.com/land/"
        );
        return Land721(address(new ERC1967Proxy(address(implementation), initData)));
    }

    function _deployShop(address admin_, address registry_, address items_, address lands_) internal returns (Shop) {
        Shop implementation = new Shop();
        bytes memory initData = abi.encodeWithSelector(Shop.initialize.selector, admin_, registry_, items_, lands_);
        address proxy = address(new ERC1967Proxy(address(implementation), initData));
        return Shop(payable(proxy));
    }
}
