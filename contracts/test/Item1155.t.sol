// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Item1155} from "../Item1155.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../libs/Errors.sol";

contract Item1155Test is Test {
    Item1155 internal item;

    address internal admin = address(0xA11CE);
    address internal user = address(0xC0FFEE);
    address internal other = address(0xBAD);

    string internal constant BASE_URI = "https://example.com/{id}.json";

    function setUp() public {
        Item1155 implementation = new Item1155();
        bytes memory initData = abi.encodeWithSelector(Item1155.initialize.selector, admin, BASE_URI);
        item = Item1155(address(new ERC1967Proxy(address(implementation), initData)));
    }

    function testInitializeGrantsRoles() public {
        assertTrue(item.hasRole(item.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(item.hasRole(item.MINTER_ROLE(), admin));
        assertTrue(item.hasRole(item.BURNER_ROLE(), admin));
        assertTrue(item.hasRole(item.URI_MANAGER_ROLE(), admin));
    }

    function testMintIncreasesBalanceAndSupply() public {
        vm.prank(admin);
        item.mint(user, 1, 10, "");

        assertEq(item.balanceOf(user, 1), 10);
        assertEq(item.totalSupply(1), 10);
    }

    function testMintRevertsOnZeroRecipient() public {
        vm.prank(admin);
        vm.expectRevert(ZeroAddress.selector);
        item.mint(address(0), 1, 10, "");
    }

    function testMintRevertsOnZeroAmount() public {
        vm.prank(admin);
        vm.expectRevert(InvalidValue.selector);
        item.mint(user, 1, 0, "");
    }

    function testMintRevertsWhenCallerNotMinter() public {
        vm.expectRevert();
        vm.prank(other);
        item.mint(user, 1, 1, "");
    }

    function testMintBatchWorks() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 2;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 5;
        amounts[1] = 15;

        vm.prank(admin);
        item.mintBatch(user, ids, amounts, "");

        assertEq(item.balanceOf(user, 1), 5);
        assertEq(item.balanceOf(user, 2), 15);
        assertEq(item.totalSupply(1), 5);
        assertEq(item.totalSupply(2), 15);
    }

    function testMintBatchRevertsOnLengthMismatch() public {
        uint256[] memory ids = new uint256[](1);
        ids[0] = 1;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 5;
        amounts[1] = 10;

        vm.prank(admin);
        vm.expectRevert(LengthMismatch.selector);
        item.mintBatch(user, ids, amounts, "");
    }

    function testMintBatchRevertsOnZeroAmount() public {
        uint256[] memory ids = new uint256[](1);
        ids[0] = 1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 0;

        vm.prank(admin);
        vm.expectRevert(InvalidValue.selector);
        item.mintBatch(user, ids, amounts, "");
    }

    function testBurnReducesSupply() public {
        vm.startPrank(admin);
        item.mint(user, 1, 10, "");
        item.burn(user, 1, 3);
        vm.stopPrank();

        assertEq(item.balanceOf(user, 1), 7);
        assertEq(item.totalSupply(1), 7);
    }

    function testBurnRevertsOnZeroAmount() public {
        vm.prank(admin);
        vm.expectRevert(InvalidValue.selector);
        item.burn(user, 1, 0);
    }

    function testBurnRevertsWhenCallerNotBurner() public {
        vm.prank(admin);
        item.mint(user, 1, 3, "");

        vm.expectRevert();
        vm.prank(other);
        item.burn(user, 1, 1);
    }

    function testBurnBatchReducesSupply() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 2;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 5;
        amounts[1] = 6;

        vm.startPrank(admin);
        item.mintBatch(user, ids, amounts, "");

        uint256[] memory burnAmounts = new uint256[](2);
        burnAmounts[0] = 3;
        burnAmounts[1] = 2;
        item.burnBatch(user, ids, burnAmounts);
        vm.stopPrank();

        assertEq(item.balanceOf(user, 1), 2);
        assertEq(item.balanceOf(user, 2), 4);
        assertEq(item.totalSupply(1), 2);
        assertEq(item.totalSupply(2), 4);
    }

    function testBurnBatchRevertsOnLengthMismatch() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 2;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 5;

        vm.prank(admin);
        vm.expectRevert(LengthMismatch.selector);
        item.burnBatch(user, ids, amounts);
    }

    function testPauseBlocksTransfers() public {
        vm.startPrank(admin);
        item.mint(admin, 1, 5, "");
        item.pause();
        vm.expectRevert(bytes4(keccak256("EnforcedPause()")));
        item.safeTransferFrom(admin, user, 1, 1, "");
        vm.stopPrank();
    }

    function testUnpauseAllowsTransfers() public {
        vm.startPrank(admin);
        item.mint(admin, 1, 5, "");
        item.pause();
        item.unpause();
        item.safeTransferFrom(admin, user, 1, 2, "");
        vm.stopPrank();

        assertEq(item.balanceOf(admin, 1), 3);
        assertEq(item.balanceOf(user, 1), 2);
    }

    function testSetUriUpdatesBaseUri() public {
        vm.prank(admin);
        item.setURI("ipfs://new/{id}.json");

        assertEq(item.uri(0), "ipfs://new/{id}.json");
    }

    function testSetUriRevertsForUnauthorized() public {
        vm.expectRevert();
        vm.prank(other);
        item.setURI("ipfs://unauthorized/{id}");
    }
}
