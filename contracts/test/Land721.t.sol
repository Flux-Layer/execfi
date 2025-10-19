// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

import {Land721} from "../Land721.sol";
import "../libs/Errors.sol";

contract Land721Test is Test {
    Land721 internal land;

    address internal admin = address(0xA11CE);
    address internal user = address(0xBEEF);
    address internal other = address(0xC0FFEE);

    string internal constant NAME = "Greenvale Land";
    string internal constant SYMBOL = "GVLAND";
    string internal constant BASE_URI = "https://example.com/lands/";

    function setUp() public {
        land = _deployLand(admin, NAME, SYMBOL, BASE_URI);
    }

    function testInitializeSetsState() public {
        assertTrue(land.hasRole(land.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(land.hasRole(land.MINTER_ROLE(), admin));
        assertTrue(land.hasRole(land.METADATA_ROLE(), admin));
        assertEq(land.nextTokenId(), 1);
        assertEq(land.name(), NAME);
        assertEq(land.symbol(), SYMBOL);
        vm.prank(admin);
        uint256 tokenId = land.mint(admin);
        assertEq(land.tokenURI(tokenId), string.concat(BASE_URI, vm.toString(tokenId)));
    }

    function testMintAssignsTokenAndIncrementsCounter() public {
        vm.prank(admin);
        uint256 tokenId = land.mint(user);

        assertEq(tokenId, 1);
        assertEq(land.ownerOf(tokenId), user);
        assertEq(land.nextTokenId(), 2);
        assertEq(land.totalSupply(), 1);
    }

    function testMintRevertsOnZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(ZeroAddress.selector);
        land.mint(address(0));
    }

    function testMintRevertsWhenCallerNotMinter() public {
        vm.expectRevert();
        vm.prank(other);
        land.mint(user);
    }

    function testMintBatchMintsSequentialTokens() public {
        vm.prank(admin);
        uint256[] memory tokenIds = land.mintBatch(user, 2);

        assertEq(tokenIds.length, 2);
        assertEq(tokenIds[0], 1);
        assertEq(tokenIds[1], 2);
        assertEq(land.totalSupply(), 2);
        assertEq(land.tokenOfOwnerByIndex(user, 0), 1);
        assertEq(land.tokenOfOwnerByIndex(user, 1), 2);
        assertEq(land.tokenByIndex(0), 1);
        assertEq(land.tokenByIndex(1), 2);
        assertEq(land.nextTokenId(), 3);
    }

    function testMintBatchRevertsOnZeroQuantity() public {
        vm.prank(admin);
        vm.expectRevert(InvalidValue.selector);
        land.mintBatch(user, 0);
    }

    function testMintRevertsWhenUserReachedLimit() public {
        vm.prank(admin);
        land.mintBatch(user, 4);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(LandLimitReached.selector, user));
        land.mint(user);
    }

    function testMintBatchRevertsWhenExceedingLimit() public {
        vm.prank(admin);
        land.mintBatch(user, 3);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(LandLimitReached.selector, user));
        land.mintBatch(user, 2);
    }

    function testMintBatchRevertsOnZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(ZeroAddress.selector);
        land.mintBatch(address(0), 1);
    }

    function testPauseBlocksTransfers() public {
        vm.prank(admin);
        uint256 tokenId = land.mint(admin);

        vm.prank(admin);
        land.pause();

        vm.expectRevert(bytes4(keccak256("EnforcedPause()")));
        vm.prank(admin);
        land.safeTransferFrom(admin, user, tokenId);
    }

    function testUnpauseAllowsTransfers() public {
        vm.startPrank(admin);
        uint256 tokenId = land.mint(admin);
        land.pause();
        land.unpause();
        land.safeTransferFrom(admin, user, tokenId);
        vm.stopPrank();

        assertEq(land.ownerOf(tokenId), user);
    }

    function testSetBaseURI() public {
        vm.prank(admin);
        land.setBaseURI("ipfs://lands/");

        vm.prank(admin);
        uint256 tokenId = land.mint(admin);
        assertEq(land.tokenURI(tokenId), string.concat("ipfs://lands/", vm.toString(tokenId)));
    }

    function testSetBaseURIRevertsWhenUnauthorized() public {
        vm.expectRevert();
        vm.prank(other);
        land.setBaseURI("ipfs://unauth/");
    }

    function testSupportsInterface() public {
        assertTrue(land.supportsInterface(type(IERC165).interfaceId));
        assertTrue(land.supportsInterface(type(IERC721).interfaceId));
        assertTrue(land.supportsInterface(type(IERC721Enumerable).interfaceId));
    }

    function _deployLand(
        address admin_,
        string memory name_,
        string memory symbol_,
        string memory baseUri_
    ) internal returns (Land721) {
        Land721 implementation = new Land721();
        bytes memory initData = abi.encodeWithSelector(Land721.initialize.selector, admin_, name_, symbol_, baseUri_);
        return Land721(address(new ERC1967Proxy(address(implementation), initData)));
    }
}
