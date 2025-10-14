# XPRegistry (Foundry)

XPRegistry keeps an on-chain ledger of experience points (XP) that are minted only when a trusted game signer issues a valid EIP-712 signature. Designed for Base Sepolia (chainId **84532**).

## Project Layout

```
contracts/xp-registry/
├── contracts/XPRegistry.sol        # Core UUPS contract (AccessControl + Pausable + ReentrancyGuard + EIP712)
├── script/DeployXPRegistry.s.sol   # Deploys implementation + ERC1967 proxy (prints addresses + domain separator)
├── test/XPRegistry.t.sol           # Unit, fuzz, and gas tests using forge-std
├── foundry.toml                    # Foundry configuration (solc 0.8.24, optimizer 200 runs)
└── .env.example                    # Example env vars for scripts (PRIVATE_KEY, RPC_URL_BASE_SEPOLIA)
```

## Getting Started

```bash
cd contracts/xp-registry
forge --version

# install dependencies
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0
forge install OpenZeppelin/openzeppelin-contracts-upgradeable@v5.1.0
forge install foundry-rs/forge-std@v1.7.6
```

Copy `.env.example` to `.env` and set:

```dotenv
PRIVATE_KEY=0x...
RPC_URL_BASE_SEPOLIA=https://sepolia.base.org/YOUR-ENDPOINT
```

## Build & Test

```bash
forge build
forge test
forge test --match-test testAddXPWithValidSignature -vv
forge test --match-test testFuzzAddXP -vv
```
> Konfigurasi `foundry.toml` sudah mengaktifkan optimizer dan `via_ir = true` untuk menghindari error “stack too deep”. Jika baru memodifikasi kontrak, jalankan `forge clean` sebelum build ulang.

## Deploy to Base Sepolia (ChainId 84532)

```bash
export PRIVATE_KEY=0x...
export RPC_URL_BASE_SEPOLIA="https://sepolia.base.org/YOUR-ENDPOINT"

forge script script/DeployXPRegistry.s.sol \
  --rpc-url $RPC_URL_BASE_SEPOLIA \
  --private-key $PRIVATE_KEY \
  --broadcast
```

The script prints the implementation and proxy addresses alongside the EIP-712 domain separator to help configure off-chain signers.

### Verification

Verify both the implementation and the proxy on BaseScan (chainId 84532):

```bash
# implementation (contract path: contracts/XPRegistry.sol:XPRegistry)
forge verify-contract \
  --chain-id 84532 \
  --watch \
  --constructor-args 0x \
  <IMPLEMENTATION_ADDRESS> \
  contracts/XPRegistry.sol:XPRegistry

# ERC1967 proxy (constructor args = implementation address + init calldata)
INIT_DATA=$(cast abi-encode "function initialize(address)" "$ADMIN_ADDRESS")
CONSTRUCTOR_ARGS=$(cast abi-encode "function constructor(address,bytes)" <IMPLEMENTATION_ADDRESS> "$INIT_DATA")

forge verify-contract \
  --chain-id 84532 \
  --watch \
  --constructor-args $CONSTRUCTOR_ARGS \
  <PROXY_ADDRESS> \
  @openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy
```

## Upgrading

1. Deploy a new implementation (`XPRegistry` derivative) that preserves storage layout.
2. As the admin, call `upgradeTo(newImplementation)` on the proxy (recommend using a multisig/timelock).
3. Re-run the verification step for the new implementation address.
4. Reconfigure monitoring/off-chain services if ABI changes.

## EIP-712 Signature Template

```ts
const domain = {
  name: "XPRegistry",
  version: "1",
  chainId: 84532,
  verifyingContract: registryAddress,
};

const types = {
  XPAdd: [
    { name: "user", type: "address" },
    { name: "gameId", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

const value = {
  user,
  gameId,
  amount,
  nonce: await registry.getNonce(user, gameId),
  deadline: Math.floor(Date.now() / 1000) + 3600,
};

const signature = await signer._signTypedData(domain, types, value);
await registry.addXPWithSig(user, gameId, amount, value.deadline, signature);
```

## Security Checklist & Mitigations

- **Replay & front-running**: per-user/game nonces and deadlines, domain separator bound to chain and contract, nonce consumed before state changes.
- **Privilege abuse**: all admin functions gated by `DEFAULT_ADMIN_ROLE`, events emitted on every mutation, emergency signer rotation requires paused state, `_authorizeUpgrade` restricts UUPS upgrades to the admin.
- **Reentrancy & DoS**: `ReentrancyGuardUpgradeable` prevents nested calls, CEI pattern ensures state updates precede future external interactions, optional per-game rate limits cap work per tx, `setGameActive` allows locking compromised games.
- **Circuit breaker**: `pause()/unpause()` (Pausable) lets admins halt XP minting on anomalies.
- **Audit guidance**: comments recommend Slither, MythX/Certora, and extra fuzz runs before mainnet deployment.

## Recommended Tooling

- Static analysis: `slither .`
- Symbolic tools: MythX / Certora Prover
- Fuzzing: `forge test --fuzz-runs 5000`
- Monitoring: subscribe to `XPIncreased` & `NonceUsed` events for operational observability.
