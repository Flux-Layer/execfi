// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "../lib/forge-std/src/Test.sol";
import {FeeEntryPoint} from "../src/FeeEntryPoint.sol";
import {ERC1967Proxy} from "../lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "../lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
  constructor() ERC20("Mock", "MOCK") {}
  function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract FeeEntryPointTest is Test {
  FeeEntryPoint feeEP;
  address owner = address(0xA11CE);
  address recipient = address(0xBEEF);
  address feeRecipient = address(0xFEE5);
  MockToken token;

  function setUp() public {
    // Deploy implementation
    FeeEntryPoint impl = new FeeEntryPoint();
    // Prepare init data
    bytes memory initData = abi.encodeCall(FeeEntryPoint.initialize, (feeRecipient, 50, true));
    // Deploy proxy and run initializer as `owner`
    vm.startPrank(owner);
    ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
    vm.stopPrank();
    feeEP = FeeEntryPoint(payable(address(proxy)));

    token = new MockToken();
  }

  function test_ETH_ForwardFee() public {
    uint256 sendAmt = 1 ether;
    uint256 fee = sendAmt * 50 / 10_000; // 0.5%
    uint256 net = sendAmt - fee;

    vm.deal(address(this), sendAmt);

    uint256 balBeforeTo = recipient.balance;
    uint256 balBeforeFee = feeRecipient.balance;

    feeEP.transferETH{value: sendAmt}(payable(recipient));

    assertEq(recipient.balance - balBeforeTo, net, "recipient net");
    assertEq(feeRecipient.balance - balBeforeFee, fee, "fee recipient");
  }

  function test_Token_ForwardFee() public {
    uint256 mintAmt = 10_000e18;
    token.mint(address(this), mintAmt);

    uint256 transferAmt = 1_000e18;
    token.approve(address(feeEP), transferAmt);

    uint256 fee = transferAmt * 50 / 10_000;
    uint256 net = transferAmt - fee;

    uint256 toBefore = token.balanceOf(recipient);
    uint256 feeBefore = token.balanceOf(feeRecipient);

    feeEP.transferERC20(address(token), recipient, transferAmt);

    assertEq(token.balanceOf(recipient) - toBefore, net, "recipient net");
    assertEq(token.balanceOf(feeRecipient) - feeBefore, fee, "fee recipient");
  }

  function test_ParkedFee_Withdraw() public {
    // turn off forwarding
    vm.prank(owner);
    feeEP.setForwardMode(false);

    vm.deal(address(this), 1 ether);
    // fee will be parked
    feeEP.transferETH{value: 1 ether}(payable(recipient));

    // withdraw parked fee to feeRecipient
    uint256 balBefore = feeRecipient.balance;
    uint256 expectedFee = 1 ether * 50 / 10_000;

    vm.prank(owner);
    feeEP.withdrawETH(expectedFee, payable(feeRecipient));
    assertEq(feeRecipient.balance - balBefore, expectedFee, "withdraw fee");
  }
}
