// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Marketplace} from "../Marketplace.sol";
import {ParameterRegistry} from "../ParameterRegistry.sol";
import {Item1155} from "../Item1155.sol";
import {Land721} from "../Land721.sol";
import {MarketplaceListing} from "../libs/Structs.sol";
import "../libs/Errors.sol";

contract MarketplaceTest is Test {
    address internal admin = address(0xA11CE);
    address internal treasury = address(0xFEE);
    address internal seller = address(0xBEEF);
    address internal buyer = address(0xCAFE);

    ParameterRegistry internal registry;
    Item1155 internal items;
    Land721 internal lands;
    Marketplace internal market;

    function setUp() public {
        registry = _deployRegistry(admin, treasury);
        items = _deployItem1155(admin);
        lands = _deployLand(admin);
        market = _deployMarketplace(admin, address(registry), address(items), address(lands));

        vm.startPrank(admin);
        registry.setMarketplaceFeeBps(250); // 2.5%
        items.grantRole(items.MINTER_ROLE(), admin);
        lands.grantRole(lands.MINTER_ROLE(), admin);
        vm.stopPrank();

        vm.deal(buyer, 10 ether);
        vm.deal(seller, 1 ether);

        vm.prank(admin);
        items.mint(seller, 200_001, 10, "");

        vm.prank(admin);
        lands.mint(seller);

        vm.prank(seller);
        items.setApprovalForAll(address(market), true);

        vm.prank(seller);
        lands.approve(address(market), 1);
    }

    function testListAndBuy1155Partial() public {
        vm.startPrank(seller);
        uint256 listingId = market.list1155(200_001, 10, 0.02 ether, 0);
        vm.stopPrank();

        uint256 sellerBalanceBefore = seller.balance;
        uint256 treasuryBefore = treasury.balance;

        vm.prank(buyer);
        market.buy1155{value: 0.06 ether}(listingId, 3);

        assertEq(items.balanceOf(buyer, 200_001), 3);
        assertEq(items.balanceOf(address(market), 200_001), 7);

        uint256 expectedFee = (0.06 ether * 250) / 10_000;
        assertEq(treasury.balance, treasuryBefore + expectedFee);
        assertEq(seller.balance, sellerBalanceBefore + (0.06 ether - expectedFee));

        MarketplaceListing memory listing = market.getListing(listingId);
        assertEq(listing.amount, 7);
    }

    function testBuyRemaining1155ClearsListing() public {
        vm.prank(seller);
        uint256 listingId = market.list1155(200_001, 5, 0.01 ether, 0);

        vm.prank(buyer);
        market.buy1155{value: 0.05 ether}(listingId, 5);

        MarketplaceListing memory listing = market.getListing(listingId);
        assertEq(listing.seller, address(0));
        assertEq(items.balanceOf(address(market), 200_001), 0);
    }

    function testListAndBuy721() public {
        vm.prank(seller);
        uint256 listingId = market.list721(1, 0.3 ether, 0);

        uint256 treasuryBefore = treasury.balance;
        vm.prank(buyer);
        market.buy721{value: 0.3 ether}(listingId);

        assertEq(lands.ownerOf(1), buyer);
        uint256 expectedFee = (0.3 ether * 250) / 10_000;
        assertEq(treasury.balance, treasuryBefore + expectedFee);
    }

    function testCancelListingReturnsAssets() public {
        vm.prank(seller);
        uint256 listingId = market.list1155(200_001, 4, 0.02 ether, 0);

        vm.prank(seller);
        market.cancelListing(listingId);

        assertEq(items.balanceOf(seller, 200_001), 10);
        MarketplaceListing memory listing = market.getListing(listingId);
        assertEq(listing.seller, address(0));
    }

    function testBuyAfterExpiryReverts() public {
        uint64 expiry = uint64(block.timestamp + 1);
        vm.prank(seller);
        uint256 listingId = market.list1155(200_001, 2, 0.01 ether, expiry);

        vm.warp(block.timestamp + 2);
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(SignatureExpired.selector, expiry));
        market.buy1155{value: 0.02 ether}(listingId, 2);
    }

    function testBuyWithWrongPaymentReverts() public {
        vm.prank(seller);
        uint256 listingId = market.list1155(200_001, 2, 0.01 ether, 0);

        vm.prank(buyer);
        vm.expectRevert(InvalidValue.selector);
        market.buy1155{value: 0.01 ether}(listingId, 2);
    }

    function testOnlySellerCanCancel() public {
        vm.prank(seller);
        uint256 listingId = market.list1155(200_001, 2, 0.01 ether, 0);

        vm.prank(buyer);
        vm.expectRevert(Unauthorized.selector);
        market.cancelListing(listingId);
    }

    function _deployRegistry(address admin_, address treasury_) internal returns (ParameterRegistry) {
        ParameterRegistry implementation = new ParameterRegistry();
        bytes memory initData = abi.encodeWithSelector(
            ParameterRegistry.initialize.selector,
            admin_,
            treasury_,
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

    function _deployMarketplace(address admin_, address registry_, address items_, address lands_)
        internal
        returns (Marketplace)
    {
        Marketplace implementation = new Marketplace();
        bytes memory initData = abi.encodeWithSelector(Marketplace.initialize.selector, admin_, registry_, items_, lands_);
        address proxy = address(new ERC1967Proxy(address(implementation), initData));
        return Marketplace(payable(proxy));
    }
}
