# Degenshoot – XP & Wager Vault Stack

This Foundry workspace bundles two on-chain components for the **Degenshoot** mini-game on Base Sepolia (chainId `84532`):

1. **Degenshoot.sol** – Verifies signed game results (EIP-712) and forwards earned XP to the existing XPRegistry proxy at `0xf77678E650a84FcA39aA66cd9EabcD1D28182035`.
2. **WagerVault.sol** – Escrows ETH wagers per session, settles winnings once a session is verified, and exposes a pull-based withdrawal flow.

All interactions with XPRegistry occur through the provided proxy; the contracts themselves do not hold XP logic.

---

## Repository Structure

```
contracts/
  degenshoot/Degenshoot.sol  # EIP-712 result verifier + XP forwarder
  vault/WagerVault.sol        # Escrow + settlement vault
  interfaces/IXPRegistry.sol # Minimal interface for the existing XPRegistry proxy
script/DeployAll.s.sol       # Deploy Degenshoot + WagerVault with one broadcast
test/
  Degenshoot.t.sol           # Unit tests for signature, replay, pause logic
  WagerVault.t.sol           # Unit tests for escrow, payout, withdraw flows
foundry.toml                 # solc 0.8.24, optimizer 200 runs, via-IR enabled
.env.example                 # Deployment env template
README.md                    # This file
```

---

## Contracts Overview

### Degenshoot.sol

* Inherits `AccessControl`, `Pausable`, `ReentrancyGuard`, and `EIP712`.
* Immutable pointers: `REGISTRY` (XPRegistry proxy) and `GAME_ID`.
* Maintains `gameSigner` (off-chain backend signer) and `sessionUsed` map for anti-replay.
* EIP-712 domain: `name = "Degenshoot"`, `version = "1"`, `chainId = block.chainid`, verifying contract = this contract.
* `Result` struct fields correspond exactly to the backend payload. Type hash:
  ```solidity
  keccak256(
    "Result(address user,uint256 gameId,uint64 sessionId,uint32 score,uint32 kills,uint32 timeAlive,uint256 wager,uint256 multiplierX100,uint256 xp,uint256 deadline)"
  )
  ```
* `submitResultAndClaimXP` verifies the result signature, marks the session as consumed before external calls (CEI & anti-replay), and calls `XPRegistry.addXpWithSig` to credit XP (second signature is checked by XPRegistry itself).
* Events: `GameSignerUpdated`, `ResultAccepted`, `SessionConsumed`.
* Circuit breaker via `pause()/unpause()`.

### WagerVault.sol

* Holds ETH wagers indexed by the same session key used in Degenshoot (`keccak256(abi.encode(user, gameId, sessionId))`).
* Only Degenshoot can call `settle`, ensuring a session result is validated (`sessionUsed == true`) before releasing funds.
* `houseFeeBps` extracted to treasury in BPS (0-10_000). Net winnings credited to player and withdrawable via pull payments (`withdraw`).
* Events: `BetPlaced`, `Settled`, `Withdrawn`, `TreasuryUpdated`, `FeeUpdated`.
* AccessControl protects treasury/fee updates; withdrawals use `ReentrancyGuard`.

### EIP-712 Summary

**Result struct** (signed by game backend):

| Field | Type | Notes |
|-------|------|-------|
| user | address | player wallet |
| gameId | uint256 | expected to equal constructor `GAME_ID` |
| sessionId | uint64 | match escrow session |
| score | uint32 | raw score |
| kills | uint32 | supporting stat |
| timeAlive | uint32 | seconds survived |
| wager | uint256 | ETH wager in wei |
| multiplierX100 | uint256 | payout multiplier scaled by 100 |
| xp | uint256 | XP to award |
| deadline | uint256 | unix timestamp |

**XP add struct** is handled by XPRegistry (`XPAdd(address user,uint256 gameId,uint256 amount,uint256 nonce,uint256 deadline)`), and signatures must target the XPRegistry proxy at `0xf77678E650a84FcA39aA66cd9EabcD1D28182035`.

---

## Getting Started

```bash
cd contracts
cp .env.example .env                         # fill in keys & addresses
forge install OpenZeppelin/openzeppelin-contracts
forge install OpenZeppelin/openzeppelin-contracts-upgradeable
forge install foundry-rs/forge-std
forge build
forge test -vv
```

### Deployment (Base Sepolia)

```bash
export PRIVATE_KEY=0x...
export RPC_URL_BASE_SEPOLIA="https://base-sepolia.g.alchemy.com/v2/YOUR_KEY"
export ADMIN_ADDRESS=0x...
export GAME_SIGNER_ADDRESS=0x...
export XP_REGISTRY_PROXY=0xf77678E650a84FcA39aA66cd9EabcD1D28182035
export GAME_ID=1
export TREASURY_ADDRESS=0x...
export HOUSE_FEE_BPS=500

forge script script/DeployAll.s.sol \
  --rpc-url $RPC_URL_BASE_SEPOLIA \
  --private-key $PRIVATE_KEY \
  --broadcast
```

Script output includes both contract addresses and the Degenshoot domain separator (for backend signing).

---

## Testing Highlights

* `Degenshoot.t.sol` covers:
  * Successful result submission + XP forwarding (events & registry mock confirmations).
  * Expired result / expired XP deadline.
  * Signature mismatch, replay attempts, invalid payloads, and pause enforcement.
* `WagerVault.t.sol` covers:
  * End-to-end flow: place bet → settle (after Degenshoot marks session) → withdraw.
  * Reverts for zero stake, missing verification, double settlement, non-degenshoot caller.
* Fuzz test confirms payout/fee calculations for varied multipliers & fee BPS.

Run the suite with:

```bash
forge test -vv
```

---

## EIP-712 Signing Example (ethers v6)

```ts
import { ethers } from "ethers";

const degenshootAddress = "0x...";
const registryProxy = "0xf77678E650a84FcA39aA66cd9EabcD1D28182035";
const chainId = 84532;

const resultDomain = {
  name: "Degenshoot",
  version: "1",
  chainId,
  verifyingContract: degenshootAddress,
};

const resultTypes = {
  Result: [
    { name: "user", type: "address" },
    { name: "gameId", type: "uint256" },
    { name: "sessionId", type: "uint64" },
    { name: "score", type: "uint32" },
    { name: "kills", type: "uint32" },
    { name: "timeAlive", type: "uint32" },
    { name: "wager", type: "uint256" },
    { name: "multiplierX100", type: "uint256" },
    { name: "xp", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

const resultValue = {
  user,
  gameId: 1n,
  sessionId,
  score,
  kills,
  timeAlive,
  wager: wagerWei,
  multiplierX100,
  xp,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
};

const resultSignature = await backendSigner.signTypedData(resultDomain, resultTypes, resultValue);

// XP signature (XPRegistry domain Name="XPRegistry", Version="1")
const xpDomain = {
  name: "XPRegistry",
  version: "1",
  chainId,
  verifyingContract: registryProxy,
};

const xpTypes = {
  XPAdd: [
    { name: "user", type: "address" },
    { name: "gameId", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

const nonce = await registryContract.getNonce(user, 1);
const xpValue = {
  user,
  gameId: 1n,
  amount: xp,
  nonce,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
};

const xpSignature = await xpSigner.signTypedData(xpDomain, xpTypes, xpValue);

// Submit from client/relayer
await degenshootContract.submitResultAndClaimXP(resultValue, resultSignature, xpValue.deadline, xpSignature);
```

---

## Notes

* All XP writes **must** go through the proxy XPRegistry (`0xf776…2035`).
* `sessionKey` is deterministic (`keccak256(abi.encode(user, gameId, sessionId))`) and shared between Degenshoot and WagerVault.
* Use `sessionUsed(key)` to guard against replay (available via public mapping in Degenshoot).
* The vault uses pull payments—**always** call `withdraw` instead of pushing funds in `settle`.
* Frontend wiring expects the following environment variables:

  ```bash
  NEXT_PUBLIC_DEGENSHOOT_ADDRESS=0x640b3AA6FE0B70F67535B0179b0d1d1d941aDf86
  NEXT_PUBLIC_WAGER_VAULT_ADDRESS=0x75123f823ed477DA70a2F1680C0Ddb3d4E1Bb745
  NEXT_PUBLIC_XP_REGISTRY_PROXY=0xf77678E650a84FcA39aA66cd9EabcD1D28182035
  NEXT_PUBLIC_DEGENSHOOT_CHAIN_ID=84532
  GAME_SIGNER_PRIVATE_KEY=<backend signer key for /api/degenshoot/sign>
  ```

  These values are consumed by the Bomb mini-game to place wagers, request result signatures, and submit XP rewards.

Happy building on Base Sepolia!
