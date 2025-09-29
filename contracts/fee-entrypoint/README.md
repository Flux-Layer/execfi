# FeeEntryPoint (Upgradeable, Deterministic)

A minimal upgradeable entrypoint contract that applies a configurable fee (default 0.5%) to ETH and ERC‑20 transfers, supporting two fee handling modes:

- Forward Immediately: Fee is sent to `feeRecipient` at call time (recommended)
- Park in Contract: Fee is retained in the contract for later withdrawal by admin

This package includes a deterministic (CREATE2) deployment script to keep the same proxy address across chains, provided you use the same factory and salt.

## Features

- UUPS upgradeable (Ownable) with storage safety
- Fee in basis points (`feeBps`), capped by `MAX_FEE_BPS`
- ETH transfers via `transferETH(to)` payable
- ERC‑20 transfers via `transferERC20(token, to, amount)` with safe handling for fee‑on‑transfer tokens
- Dual mode fee handling: forward vs parked (toggleable)
- Admin controls: set fee recipient, set fee bps, toggle mode, withdraw (if parked)
- ReentrancyGuard + SafeERC20
- Deterministic CREATE2 deploy script for Implementation and Proxy

## Layout

- `src/FeeEntryPoint.sol` — the upgradeable entrypoint
- `script/DeployDeterministic.s.sol` — deploy implementation + proxy deterministically (CREATE2)
- `test/FeeEntryPoint.t.sol` — basic unit tests

## Quick Start

1) Install Foundry
- macOS/Linux: `curl -L https://foundry.paradigm.xyz | bash` then `foundryup`

2) In this folder
- Install deps (OpenZeppelin upgradeable + std):
  - `forge install OpenZeppelin/openzeppelin-contracts-upgradeable OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std`
- Build: `forge build`
- Test: `forge test -vv`

3) Deterministic Deploy (per chain)
- Requirements for SAME address across chains:
  - Use the same CREATE2 factory address across chains (e.g. EIP‑2470 singleton factory `0xCE0042B868300000d44A59004Da54A005ffdcf9f` or Universal Deployer `0x4e59b44847b379578588920cA78FbF26c0B4956C`),
  - Use the same `SALT`,
  - Keep bytecode + constructor args identical (impl and proxy init data must be identical).
- Env variables (example):
  - `export RPC_URL=...`
  - `export PRIVATE_KEY=0x...` (deployer EOA)
  - `export CREATE2_FACTORY=0xCE0042B868300000d44A59004Da54A005ffdcf9f` (or 0x4e59... if available)
  - `export SALT=0x6665655f656e747279706f696e745f7631aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
  - `export FEE_RECIPIENT=0xYourFeeRecipient`
  - `export FEE_BPS=50` (0.5%)
  - `export FORWARD_IMMEDIATELY=true` (or false)
- Run:
  - `forge script script/DeployDeterministic.s.sol:DeployDeterministic --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast -vv`

Notes:
- If the chosen factory doesn’t exist on a target chain, the CREATE2 address will differ if you switch factory. Ensure your supported chains have the same factory at the same address.
- If you cannot ensure a shared factory, you can still deploy deterministically per chain but the resulting proxy addresses may differ.

## Integration Hint (Frontend)
- Map `chainId -> entrypointProxyAddress` in your app config.
- For EOA transfers, call the entrypoint methods instead of sending directly to recipient.
- Preserve `accountMode` logic — this only affects the EOA path (Smart Account can also call the entrypoint if desired).

## License
- MIT (or your project’s chosen license).

