// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "../lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "../lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../lib/openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "../lib/openzeppelin-contracts-upgradeable/contracts/utils/PausableUpgradeable.sol";
import {IERC20} from "../lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "../lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";


/// @title FeeEntryPoint (UUPS Upgradeable)
/// @notice Entry point to apply a fee on ETH and ERC-20 transfers with two fee modes:
///         1) forwardImmediately = true  -> fee is sent to feeRecipient at call time
///         2) forwardImmediately = false -> fee is parked in the contract for later withdrawal
contract FeeEntryPoint is Initializable, UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable {
  using SafeERC20 for IERC20;

  /// @dev max fee (in bps) allowed by admin updates. Adjust as desired.
  uint16 public constant MAX_FEE_BPS = 1000; // 10% safety cap

  /// @notice fee recipient for collected fees
  address public feeRecipient;
  /// @notice fee in basis points (1 bps = 0.01%), e.g. 50 = 0.5%
  uint16 public feeBps;
  /// @notice when true, fee is forwarded immediately to feeRecipient; else parked in the contract
  bool public forwardImmediately;

  /// @notice Emitted when fee is collected on a transfer
  event FeeCollected(address indexed token, address indexed from, address indexed to, uint256 gross, uint256 fee, uint256 net);
  event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
  event FeeBpsUpdated(uint16 oldBps, uint16 newBps);
  event ForwardModeUpdated(bool oldMode, bool newMode);
  event FeeWithdrawnETH(address indexed to, uint256 amount);
  event FeeWithdrawnToken(address indexed token, address indexed to, uint256 amount);

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address _feeRecipient, uint16 _feeBps, bool _forwardImmediately) public initializer {
    require(_feeRecipient != address(0), "feeRecipient=0");
    require(_feeBps <= MAX_FEE_BPS, "fee too high");

    __Ownable_init(msg.sender);
    __UUPSUpgradeable_init();
    __Pausable_init();

    // initialize reentrancy guard status
    _status = _NOT_ENTERED;

    feeRecipient = _feeRecipient;
    feeBps = _feeBps;
    forwardImmediately = _forwardImmediately;
  }

  // -------------------- Admin --------------------

  function setFeeRecipient(address _recipient) external onlyOwner {
    require(_recipient != address(0), "feeRecipient=0");
    address old = feeRecipient;
    feeRecipient = _recipient;
    emit FeeRecipientUpdated(old, _recipient);
  }

  function setFeeBps(uint16 _feeBps) external onlyOwner {
    require(_feeBps <= MAX_FEE_BPS, "fee too high");
    uint16 old = feeBps;
    feeBps = _feeBps;
    emit FeeBpsUpdated(old, _feeBps);
  }

  function setForwardMode(bool _forwardImmediately) external onlyOwner {
    bool old = forwardImmediately;
    forwardImmediately = _forwardImmediately;
    emit ForwardModeUpdated(old, _forwardImmediately);
  }

  function pause() external onlyOwner {
    _pause();
  }

  function unpause() external onlyOwner {
    _unpause();
  }

  // -------------------- Public API --------------------

  /// @notice Transfer ETH to `to` applying fee. Send `msg.value`.
  function transferETH(address payable to) external payable nonReentrant whenNotPaused {
    require(to != address(0), "to=0");
    require(msg.value > 0, "no value");

    (uint256 fee, uint256 net) = _split(msg.value);

    // send net to recipient
    _safeSendETH(to, net);

    // handle fee
    if (fee > 0 && forwardImmediately) {
      _safeSendETH(payable(feeRecipient), fee);
    } // else: parked in contract balance

    emit FeeCollected(address(0), msg.sender, to, msg.value, fee, net);
  }

  /// @notice Transfer ERC-20 `amount` from msg.sender to `to` applying fee.
  ///         Requires allowance or use of permit flows.
  function transferERC20(address token, address to, uint256 amount) external nonReentrant whenNotPaused {
    require(token != address(0), "token=0");
    require(to != address(0), "to=0");
    require(amount > 0, "amount=0");

    IERC20 erc = IERC20(token);

    // snapshot balance to support fee-on-transfer tokens
    uint256 beforeBal = erc.balanceOf(address(this));
    erc.safeTransferFrom(msg.sender, address(this), amount);
    uint256 afterBal = erc.balanceOf(address(this));
    uint256 received = afterBal - beforeBal;
    require(received > 0, "no tokens received");

    (uint256 fee, uint256 net) = _split(received);

    // deliver net to recipient
    erc.safeTransfer(to, net);

    // handle fee
    if (fee > 0 && forwardImmediately) {
      erc.safeTransfer(feeRecipient, fee);
    } // else: parked in contract balance

    emit FeeCollected(token, msg.sender, to, received, fee, net);
  }

  // -------------------- Withdraw (for parked fees / rescue) --------------------

  function withdrawETH(uint256 amount, address payable to) external onlyOwner nonReentrant {
    require(to != address(0), "to=0");
    _safeSendETH(to, amount);
    emit FeeWithdrawnETH(to, amount);
  }

  function withdrawERC20(address token, uint256 amount, address to) external onlyOwner nonReentrant {
    require(token != address(0), "token=0");
    require(to != address(0), "to=0");
    IERC20(token).safeTransfer(to, amount);
    emit FeeWithdrawnToken(token, to, amount);
  }

  // -------------------- Internals --------------------

  function _split(uint256 gross) internal view returns (uint256 fee, uint256 net) {
    if (feeBps == 0) {
      return (0, gross);
    }
    fee = (gross * feeBps) / 10_000;
    net = gross - fee;
  }

  function _safeSendETH(address payable to, uint256 value) internal {
    (bool ok, ) = to.call{value: value}("");
    require(ok, "eth send failed");
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  // -------------------- Simple Reentrancy Guard --------------------
  uint256 private constant _NOT_ENTERED = 1;
  uint256 private constant _ENTERED = 2;
  uint256 private _status; // storage slot compatible across upgrades

  modifier nonReentrant() {
    require(_status != _ENTERED, "reentrant call");
    _status = _ENTERED;
    _;
    _status = _NOT_ENTERED;
  }
}
