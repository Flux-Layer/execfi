// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {FarmingCore} from "../FarmingCore.sol";
import {ParameterRegistry} from "../ParameterRegistry.sol";
import {Item1155} from "../Item1155.sol";
import {Land721} from "../Land721.sol";
import {SeedConfig} from "../libs/Structs.sol";
import {IXPRegistry} from "../interfaces/IXPRegistry.sol";
import "../libs/Errors.sol";

contract MockXPRegistry is IXPRegistry {
    struct CallData {
        address user;
        uint256 gameId;
        uint256 amount;
        uint256 deadline;
        bytes signature;
    }

    mapping(address => mapping(uint256 => uint256)) public nonces;
    CallData internal _lastCall;
    bool public shouldRevert;

    function addXpWithSig(
        address user,
        uint256 gameId,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external override {
        if (shouldRevert) revert("XP registry mock revert");
        _lastCall = CallData({user: user, gameId: gameId, amount: amount, deadline: deadline, signature: signature});
        nonces[user][gameId] += 1;
    }

    function getNonce(address account, uint256 gameId) external view override returns (uint256) {
        return nonces[account][gameId];
    }

    function domainSeparator() external pure override returns (bytes32) {
        return bytes32(0);
    }

    function lastCall() external view returns (CallData memory) {
        return _lastCall;
    }
}

contract FarmingCoreTest is Test {
    address internal admin = address(0xA11CE);
    address internal treasury = address(0xFEE);
    address internal farmer = address(0xBEEF);

    ParameterRegistry internal registry;
    Item1155 internal items;
    Land721 internal lands;
    FarmingCore internal core;
    MockXPRegistry internal xp;

    uint32 internal constant SEED_TYPE = 1;
    uint256 internal constant GAME_ID = 2;

    function setUp() public {
        registry = _deployRegistry(admin, treasury);
        items = _deployItem1155(admin);
        lands = _deployLand(admin);
        xp = new MockXPRegistry();
        core = _deployFarmingCore(admin, address(registry), address(items), address(lands), address(xp), GAME_ID);

        vm.startPrank(admin);
        registry.setSeedConfig(SEED_TYPE, 100, 3600);
        registry.setSeedConfig(SEED_TYPE + 1, 150, 5400);
        registry.setToolSpeedBps(1, 1000);
        registry.setSeasonBonusBps(500); // +5%
        items.grantRole(items.BURNER_ROLE(), address(core));
        items.grantRole(items.MINTER_ROLE(), admin);
        lands.grantRole(lands.MINTER_ROLE(), admin);
        vm.stopPrank();

        vm.prank(admin);
        lands.mint(farmer);

        vm.deal(farmer, 1 ether);

        vm.startPrank(admin);
        items.mint(farmer, 200_000 + SEED_TYPE, 10, "");
        items.mint(farmer, 200_000 + SEED_TYPE + 1, 5, "");
        items.mint(farmer, 300_000, 10, "");
        items.mint(farmer, 100_000 + 1, 1, "");
        vm.stopPrank();
    }

    function testPlantWaterHarvestFlow() public {
        vm.prank(farmer);
        core.setActiveTool(100_000 + 1);

        vm.prank(farmer);
        core.dig(1);

        uint32[] memory seeds = _seedPair(SEED_TYPE, SEED_TYPE + 1);
        vm.prank(farmer);
        core.plant(1, seeds);

        uint64 readyAtBefore = core.getPlot(1).readyAt;

        vm.prank(farmer);
        core.water(1);
        uint64 readyAtAfter = core.getPlot(1).readyAt;
        assertLt(readyAtAfter, readyAtBefore);

        vm.warp(readyAtAfter + 1);

        uint256 expectedExp = _expectedExp(SEED_TYPE) + _expectedExp(SEED_TYPE + 1);
        bytes memory dummySig = bytes("signature");

        vm.prank(farmer);
        core.harvestAndClaimXP(_toArray(1), expectedExp, block.timestamp + 60, dummySig);

        assertEq(items.balanceOf(farmer, 200_000 + SEED_TYPE), 9);
        assertEq(items.balanceOf(farmer, 200_000 + SEED_TYPE + 1), 4);
        assertEq(items.balanceOf(farmer, 300_000), 7);

        MockXPRegistry.CallData memory callData = xp.lastCall();
        assertEq(callData.user, farmer);
        assertEq(callData.gameId, GAME_ID);
        assertEq(callData.amount, expectedExp);
    }

    function testHarvestRevertsWhenNotReady() public {
        vm.prank(farmer);
        core.dig(1);

        vm.prank(farmer);
        core.plant(1, _singleSeed(SEED_TYPE));

        uint256 expectedExp = _expectedExp(SEED_TYPE);
        bytes memory dummySig = bytes("sig");

        vm.startPrank(farmer);
        vm.expectRevert(abi.encodeWithSelector(PlotNotReady.selector, 1, core.getPlot(1).readyAt));
        core.harvestAndClaimXP(_toArray(1), expectedExp, block.timestamp + 60, dummySig);
        vm.stopPrank();
    }

    function testHarvestRevertsOnExpMismatch() public {
        vm.prank(farmer);
        core.dig(1);

        vm.prank(farmer);
        core.plant(1, _singleSeed(SEED_TYPE));

        vm.warp(block.timestamp + 4 hours);

        bytes memory dummySig = bytes("sig");
        vm.prank(farmer);
        vm.expectRevert(InvalidValue.selector);
        core.harvestAndClaimXP(_toArray(1), 1, block.timestamp + 60, dummySig);
    }

    function testHarvestRespectsMaxPlots() public {
        vm.prank(admin);
        registry.setMaxPlotsPerHarvest(1);
        uint256 maxPlots = registry.maxPlotsPerHarvest();
        assertEq(maxPlots, 1);
        vm.prank(admin);
        core.syncMaxPlotsPerHarvest();
        assertEq(core.maxPlotsPerHarvest(), 1);

        vm.prank(admin);
        lands.mint(farmer);

        vm.startPrank(farmer);
        core.dig(1);
        core.plant(1, _singleSeed(SEED_TYPE));
        core.dig(2);
        core.plant(2, _singleSeed(SEED_TYPE));
        vm.stopPrank();

        assertEq(core.getPlot(1).owner, farmer);
        assertEq(core.getPlot(2).owner, farmer);

        vm.warp(block.timestamp + 4 hours);

        uint256[] memory ids = _toArray(1, 2);
        bytes memory dummySig = bytes("sig");
        vm.startPrank(farmer);
        (bool success, bytes memory revertData) = address(core).call(
            abi.encodeWithSelector(
                FarmingCore.harvestAndClaimXP.selector,
                ids,
                _expectedExp(SEED_TYPE) * 2,
                block.timestamp + 60,
                dummySig
            )
        );
        vm.stopPrank();

        assertFalse(success);
        assertEq(bytes4(revertData), HarvestLimitExceeded.selector);
    }

    function testPlantRevertsWhenSeedCountExceedsLimit() public {
        uint32[] memory seeds = new uint32[](6);
        for (uint256 i; i < seeds.length; ++i) {
            seeds[i] = SEED_TYPE;
        }

        vm.prank(farmer);
        core.dig(1);

        vm.prank(farmer);
        vm.expectRevert(InvalidValue.selector);
        core.plant(1, seeds);
    }

    function testPlantStoresMultipleSeedTypes() public {
        uint32[] memory seeds = new uint32[](3);
        seeds[0] = SEED_TYPE;
        seeds[1] = SEED_TYPE + 1;
        seeds[2] = SEED_TYPE;

        vm.prank(farmer);
        core.dig(1);

        vm.prank(farmer);
        core.plant(1, seeds);

        FarmingCore.PlotInfo memory plot = core.getPlot(1);
        assertEq(plot.seedCount, 3);
        assertEq(plot.seedTypes[0], SEED_TYPE);
        assertEq(plot.seedTypes[1], SEED_TYPE + 1);
        assertEq(plot.seedTypes[2], SEED_TYPE);
    }

    function testSetActiveToolRequiresOwnership() public {
        vm.startPrank(farmer);
        items.safeTransferFrom(farmer, address(0x1234), 100_000 + 1, 1, "");
        vm.expectRevert(Unauthorized.selector);
        core.setActiveTool(100_000 + 1);
        vm.stopPrank();
    }

    function testPlantRevertsWhenPlotNotDug() public {
        vm.startPrank(farmer);
        (bool success, bytes memory revertData) = address(core).call(
            abi.encodeWithSelector(
                FarmingCore.plant.selector,
                1,
                _singleSeed(SEED_TYPE)
            )
        );
        vm.stopPrank();

        assertFalse(success);
        assertEq(bytes4(revertData), PlotNotDug.selector);
    }

    function testPauseBlocksActions() public {
        vm.prank(admin);
        core.pause();

        vm.prank(farmer);
        vm.expectRevert(bytes4(keccak256("EnforcedPause()")));
        core.setActiveTool(100_000 + 1);
    }

    function _expectedExp(uint32 seedType) internal view returns (uint256) {
        SeedConfig memory seedCfg = registry.getSeedConfig(seedType);
        uint256 bonus = registry.seasonBonusBps();
        return (seedCfg.baseExp * (10_000 + bonus)) / 10_000;
    }

    function _toArray(uint256 a) internal pure returns (uint256[] memory arr) {
        arr = new uint256[](1);
        arr[0] = a;
    }

    function _toArray(uint256 a, uint256 b) internal pure returns (uint256[] memory arr) {
        arr = new uint256[](2);
        arr[0] = a;
        arr[1] = b;
    }

    function _singleSeed(uint32 seedType) internal pure returns (uint32[] memory arr) {
        arr = new uint32[](1);
        arr[0] = seedType;
    }

    function _seedPair(uint32 firstSeed, uint32 secondSeed) internal pure returns (uint32[] memory arr) {
        arr = new uint32[](2);
        arr[0] = firstSeed;
        arr[1] = secondSeed;
    }

    function _deployRegistry(address admin_, address treasury_) internal returns (ParameterRegistry) {
        ParameterRegistry implementation = new ParameterRegistry();
        bytes memory initData = abi.encodeWithSelector(
            ParameterRegistry.initialize.selector,
            admin_,
            treasury_,
            uint16(10),
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
        address proxy = address(new ERC1967Proxy(address(implementation), initData));
        return FarmingCore(payable(proxy));
    }
}
