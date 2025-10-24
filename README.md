# GameFi Gaming Hub

A comprehensive **Web3 gaming platform** built on the Base blockchain that combines multiple on-chain gaming experiences with unified XP/reward systems, account abstraction, and modern GameFi mechanics.

## Overview

This is a full-stack GameFi platform featuring:
- **ExecFi** - Natural language transaction execution engine with AI-powered intent parsing
- **Degenshoot** - A skill-based tile-matching game with wager mechanics
- **Sunday Quest** - A weekly quest system for earning XP
- **Unified XP System** - Cross-game progression tracked on-chain
- **Account Abstraction** - Smart wallet support via Base Account SDK and Privy Smart Accounts

The platform leverages EIP-712 signatures, UUPS upgradeable contracts, AI-assisted blockchain interactions via LI.FI, and a modern React frontend to deliver a seamless Web3 gaming experience.

---

## Features

### ExecFi - Natural Language Transaction Engine

ExecFi transforms natural language into safe, verifiable on-chain actions via an AI-powered intent pipeline:

- **Intent Parsing** - AI-assisted natural language understanding with GPT-4o Mini
- **Multi-Action Support** - Transfers, swaps, bridges, and bridge-swaps
- **Smart Account Execution** - ERC-4337 compliant via Privy Smart Accounts
- **Policy System** - Spending limits, daily caps, and recipient validation
- **LI.FI Integration** - Optimal routing for cross-chain swaps and bridges
- **Idempotency Protection** - Prevents duplicate transaction submissions
- **Terminal UI** - Interactive CLI-style interface with autocomplete
- **Multi-Chain** - Support for 9+ mainnets and testnets
- **Execution Pipeline**: Parse → Normalize → Validate → Simulate → Execute → Monitor

**Supported Operations**:
- Native ETH and ERC-20 transfers
- Same-chain token swaps (via LI.FI)
- Cross-chain bridges (same token)
- Cross-chain swaps (bridge + swap)
- ENS and address resolution

**Example Prompts**:
- "Send 0.01 ETH on Base to 0x..."
- "Swap 100 USDC for ETH on Arbitrum"
- "Bridge 50 USDC from Base to Polygon"

### Games

#### Degenshoot (Bomb Game)
- Real-time tile-matching gameplay
- ETH wager system with multiplier-based payouts
- EIP-712 signed game results for anti-cheating
- Session-based architecture with cryptographic proofs
- XP rewards integrated with XPRegistry
- Pull-based withdrawals for winnings

#### Sunday Quest System
- Weekly quest rotation with procedural generation
- Quest types: TRANSACTION, COMBO, EXPLORATION, ACHIEVEMENT, SOCIAL
- Difficulty tiers: EASY, MEDIUM, HARD, EPIC
- On-chain verification with signature-based claiming
- XP rewards scaled by difficulty

### Core Systems

- **XP Registry** - Centralized XP tracking across all games with EIP-712 signatures
- **Account Abstraction** - Smart accounts via Privy and Base Account SDK
- **Onboarding** - Device fingerprinting and tutorial flow
- **Leaderboards** - Cross-game rankings and stats
- **Session Management** - Secure session handling with TTL
- **Cross-chain** - Support for Base, Base Sepolia, and Lisk networks

---

## Tech Stack

### Frontend
- **Framework**: Next.js 15.5.2 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **State Management**: React Query (TanStack) v5.87.4, Zustand
- **Blockchain**: Wagmi v2.16.9 + Viem v2.37.8
- **Auth**: Privy v2.24.0
- **Smart Accounts**: Base Account SDK v2.4.0, Permissionless v0.2.57
- **Cross-Chain**: LI.FI SDK v3.12.11
- **AI/ML**: OpenRouter API (GPT-4o Mini)
- **Validation**: Zod v4.1.9
- **UI**: Lucide React, React Hot Toast, Motion
- **PWA**: Progressive Web App support

### Backend
- **Runtime**: Node.js 18 (Alpine)
- **API**: Next.js API Routes (serverless)
- **Database**: PostgreSQL + Prisma ORM
- **Logging**: Pino logger
- **Signatures**: EIP-712 native signing

### Smart Contracts
- **Language**: Solidity ^0.8.24
- **Framework**: Foundry
- **Patterns**: UUPS Upgradeable, AccessControl, ReentrancyGuard
- **Standards**: ERC-1155, ERC-721, EIP-712

### Infrastructure
- **Containerization**: Docker (multi-stage builds)
- **Registry**: GitHub Container Registry (GHCR)
- **CI/CD**: GitHub Actions
- **Deployment**: Watchtower auto-deploy on VPS

---

## Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/                # Backend API routes
│   │   │   ├── intent/         # ExecFi AI intent parsing
│   │   │   ├── prompt/         # General AI assistant
│   │   │   ├── degenshoot/     # Bomb game session & signing
│   │   │   ├── sunday-quest/   # Quest verification & retrieval
│   │   │   ├── onboarding/     # Device & wallet flows
│   │   │   ├── indexer/        # Leaderboards & stats
│   │   │   └── cron/           # Scheduled tasks
│   │   ├── execfi/             # ExecFi documentation page
│   │   ├── privy-auth/         # Privy authentication page
│   │   └── sunday-quest/       # Sunday Quest page
│   │
│   ├── cli/                    # ExecFi CLI system
│   │   ├── commands/           # CLI command registry
│   │   ├── effects/            # State machine effects pipeline
│   │   ├── state/              # Flow definitions and events
│   │   └── utils/              # CLI utilities
│   │
│   ├── components/             # React components
│   │   ├── apps/               # Full-featured applications
│   │   │   ├── bomb/           # Degenshoot game UI
│   │   │   ├── ExecFiNotes.tsx # ExecFi documentation notes
│   │   │   ├── Profile/        # User profile
│   │   │   └── Settings/       # Settings interface
│   │   ├── terminal/           # ExecFi terminal UI components
│   │   ├── sunday-quest/       # Quest UI components
│   │   ├── onboarding/         # Onboarding flow
│   │   └── common/             # Shared components
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useUserXp.ts        # XP query hook
│   │   ├── useSessionSigner.tsx    # Session management
│   │   └── useTerminalStore.tsx    # Terminal state management
│   │
│   ├── lib/                    # Utility libraries
│   │   ├── ai/                 # AI prompts, schemas, and parsing
│   │   ├── contracts/          # ABIs, addresses, domain separators
│   │   ├── games/              # Game-specific utilities
│   │   ├── indexer/            # Data aggregation
│   │   ├── sunday-quest/       # Quest system utilities
│   │   ├── policy/             # Transaction policy checking
│   │   ├── idempotency.ts      # Duplicate transaction prevention
│   │   ├── execute.ts          # Transaction execution
│   │   └── execute-base-account.ts # Base Account execution
│   │
│   └── providers/              # React context providers
│
├── contracts/                  # Solidity smart contracts
│   ├── fee-entrypoint/        # FeeEntryPoint.sol (upgradeable fee system)
│   ├── degenshoot/            # Degenshoot.sol + WagerVault.sol
│   ├── xp-registry/           # XPRegistry proxy
│   ├── script/                # Foundry deployment scripts
│   └── test/                  # Contract tests
│
├── prisma/                    # Database schema & migrations
├── .github/workflows/         # CI/CD pipelines
├── Dockerfile                 # Multi-stage container build
├── docker-compose.yml         # Local development
└── docker-compose.prod.yml    # Production setup
```

---

## Smart Contracts

### Deployed Contracts (Base Sepolia - Chain ID: 84532)

#### Degenshoot (Game ID: 1)
- **Degenshoot**: `0x640b3AA6FE0B70F67535B0179b0d1d1d941aDf86`
- **WagerVault**: `0x75123f823ed477DA70a2F1680C0Ddb3d4E1Bb745`

#### Shared
- **XPRegistry Proxy**: `0xf77678E650a84FcA39aA66cd9EabcD1D28182035`

#### FeeEntryPoint (Multi-chain)
- **Purpose**: Upgradeable fee collection system for ETH and ERC-20 transfers
- **Deployment**: CREATE2 deterministic deployment across chains
- **Fee**: Configurable basis points (default 0.5%)
- **Modes**: Forward immediately or park in contract
- **Status**: Deployed on Base, Base Sepolia, Lisk, and Lisk Sepolia

### Contract Architecture

```
Degenshoot / WagerVault
    ↓
XPRegistry (rewards)

FeeEntryPoint (multi-chain)
    ↓
Fee collection & forwarding
```

### Key Features
- **UUPS Upgradeable** - Proxy pattern for contract upgrades
- **AccessControl** - Role-based permissions (MINTER, PAUSER, ADMIN)
- **Pausable** - Circuit breaker for emergency stops
- **ReentrancyGuard** - Protection against reentrancy attacks
- **EIP-712** - Typed signature verification

---

## Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Foundry (for smart contracts)
- PostgreSQL (or use Docker)

### Local Development

1. **Clone the repository**
```bash
git clone <repository-url>
cd hq-hackathon-project-1
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.sample .env
# Edit .env with your configuration
```

4. **Set up database**
```bash
npx prisma migrate dev
npx prisma generate
```

5. **Run development server**
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Using Docker

```bash
# Development
docker-compose up

# Production
docker-compose -f docker-compose.prod.yml up
```

---

## Smart Contract Development

### Setup

```bash
cd contracts
cp .env.example .env
forge install
```

### Build & Test

```bash
forge build
forge test -vv
```

### Deploy

#### Degenshoot Contracts
```bash
forge script script/DeployAll.s.sol \
  --rpc-url $RPC_URL_BASE_SEPOLIA \
  --private-key $PRIVATE_KEY \
  --broadcast
```

#### FeeEntryPoint (Deterministic)
```bash
cd contracts/fee-entrypoint
forge script script/DeployDeterministic.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

---

## Environment Variables

### Required Variables

```bash
# App Identity
NEXT_PUBLIC_APP_NAME=GameFi Hub
NEXT_PUBLIC_PROJECT_ID=your-project-id

# Authentication
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
NEXT_PUBLIC_PRIVY_APP_SECRET=your-privy-secret
NEXT_PUBLIC_PRIVY_SIGNER_ID=your-signer-id

# Blockchain
NEXT_PUBLIC_ALCHEMY_KEY=your-alchemy-key
RPC_URL_BASE_SEPOLIA=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY

# ExecFi / AI
OPENROUTER_API_KEY=your-openrouter-key
NEXT_PUBLIC_LIFI_API_KEY=your-lifi-key
LIFI_API_KEY=your-lifi-key
NEXT_PUBLIC_ENABLE_LIFI_EXECUTION=true
MAX_TX_AMOUNT_ETH=10

# Degenshoot Contracts
NEXT_PUBLIC_DEGENSHOOT_ADDRESS=0x640b3AA6FE0B70F67535B0179b0d1d1d941aDf86
NEXT_PUBLIC_WAGER_VAULT_ADDRESS=0x75123f823ed477DA70a2F1680C0Ddb3d4E1Bb745
NEXT_PUBLIC_XP_REGISTRY_PROXY=0xf77678E650a84FcA39aA66cd9EabcD1D28182035
NEXT_PUBLIC_DEGENSHOOT_CHAIN_ID=84532
NEXT_PUBLIC_DEGENSHOOT_GAME_ID=1
GAME_SIGNER_PRIVATE_KEY=your-game-signer-key

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/gamefi

# Account Abstraction
NEXT_PUBLIC_ENABLE_BASE_ACCOUNT=true
NEXT_PUBLIC_BASE_ACCOUNT_APP_NAME=GameFi Hub

# Features
ONBOARDING_ENABLED=true
ONBOARDING_SKIP_ALLOWED=false
```

See `.env.sample` for the complete list of configuration options.

---

## API Routes

The backend provides API endpoints organized by feature:

### ExecFi
- `POST /api/intent` - Parse natural language intent to structured action
- `POST /api/prompt` - General AI assistant endpoint

### Degenshoot
- `POST /api/degenshoot/sign` - Sign game result
- `POST /api/degenshoot/session/new` - Create new session
- `POST /api/degenshoot/session/restore` - Restore existing session

### Sunday Quest
- `GET /api/sunday-quest/current` - Get current week's quests
- `POST /api/sunday-quest/verify` - Verify quest completion

### Onboarding
- `POST /api/onboarding/device` - Register device
- `GET /api/onboarding/progress` - Get onboarding status

### Indexer
- `GET /api/indexer/leaderboard` - Get leaderboard
- `GET /api/indexer/user/:address` - Get user stats
- `GET /api/indexer/xp/:address/:gameId` - Get XP for game

### Cron (Protected by `CRON_SECRET`)
- `POST /api/cron/cleanup` - Cleanup old sessions
- `POST /api/cron/generate-quests` - Generate weekly quests

---

## EIP-712 Signing

### Degenshoot Result Signature

```typescript
const resultDomain = {
  name: "Degenshoot",
  version: "1",
  chainId: 84532,
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

const signature = await signer.signTypedData(resultDomain, resultTypes, resultValue);
```

### XP Registry Signature

```typescript
const xpDomain = {
  name: "XPRegistry",
  version: "1",
  chainId: 84532,
  verifyingContract: xpRegistryProxy,
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

const nonce = await registryContract.getNonce(user, gameId);
const signature = await signer.signTypedData(xpDomain, xpTypes, xpValue);
```

---

## ExecFi Architecture

### Intent Pipeline

ExecFi implements a state machine-based execution pipeline with the following stages:

1. **Parse** - Convert natural language to structured intent via OpenAI GPT-4o Mini
2. **Normalize** - Resolve tokens, convert amounts, validate chain consistency
3. **Validate** - Check balances, gas, policy rules, spending limits
4. **Plan** (swaps/bridges) - Get optimal routes from LI.FI
5. **Simulate** (transfers) - Test transaction without broadcasting
6. **Confirm** - Display summary and await user confirmation
7. **Execute** - Submit transaction via Privy Smart Account
8. **Monitor** - Track on-chain confirmation and display explorer link

### Supported Chains

**Mainnets**: Base (8453), Ethereum (1), Polygon (137), Arbitrum (42161), Optimism (10), Avalanche (43114), BSC (56), Abstract (2741), Lisk (1135)

**Testnets**: Base Sepolia (84532), Ethereum Sepolia (11155111), Polygon Amoy (80002), Arbitrum Sepolia (421614), Optimism Sepolia (11155420), Avalanche Fuji (43113), BSC Testnet (97), Lisk Sepolia (4202)

### Intent Types

```typescript
// Transfer Intent
{
  action: "transfer",
  chain: "base" | chainId,
  token: { type: "native" | "erc20", symbol, decimals, address? },
  amount: "0.5" | "MAX",
  recipient: "0x..." | "ens.eth"
}

// Swap Intent
{
  action: "swap",
  fromChain: chainId,
  fromToken: symbol,
  toToken: symbol,
  amount: "100",
  slippage?: number
}

// Bridge Intent
{
  action: "bridge",
  fromChain: chainId,
  toChain: chainId,
  token: symbol,
  amount: "50"
}
```

### Security Features

- **Idempotency Guard** - Prevents duplicate submissions via userId + intent hash
- **Policy Checking** - Enforces spending limits, daily caps, recipient whitelists
- **EIP-712 Signatures** - All intents are cryptographically signed
- **Smart Account Only** - Non-custodial ERC-4337 execution
- **Simulation First** - Test transactions before broadcasting
- **Rate Limiting** - Protection against abuse

---

## Deployment

### CI/CD Pipeline

The project uses GitHub Actions for automated deployment:

1. **Trigger**: Push to `staging` branch or manual workflow dispatch
2. **Build**: Docker image built with multi-stage process
3. **Registry**: Image pushed to `ghcr.io` with tags:
   - `staging` (branch name)
   - `staging-{commit-sha}` (specific commit)
   - `latest` (if default branch)
4. **Deploy**: Watchtower on VPS auto-deploys within 5 minutes

### Manual Deployment

```bash
# Build image
docker build -t gamefi-hub .

# Run container
docker run -p 3290:3290 --env-file .env gamefi-hub
```

### Environment Configuration

All secrets are injected via GitHub repository secrets at build time. Configure your repository with:
- `GHCR_TOKEN` - GitHub Container Registry token
- `VPS_SSH_KEY` - VPS SSH key for deployment
- All application environment variables (80+ secrets)

---

## Database Schema

### Main Tables

- **User** - User profiles & onboarding state
- **Device** - Device fingerprinting for onboarding
- **GameSession** - Degenshoot game sessions
- **QuestTemplate** - Available quest templates
- **WeeklyQuestRotation** - Current week's quest pool
- **UserQuestProgress** - Individual quest tracking
- **QuestCompletionEvent** - Quest claim history

### Migrations

```bash
# Create migration
npx prisma migrate dev --name description

# Apply migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

---

## Testing

### Frontend Tests
```bash
npm test
```

### Smart Contract Tests
```bash
cd contracts
forge test -vv
```

### Test Coverage
```bash
forge coverage
```

---

## Security Considerations

- **Private Keys**: Stored in GitHub secrets, never committed
- **Signatures**: EIP-712 domain-separated, replay-protected via nonce
- **Access Control**: Role-based permissions on all admin functions
- **Reentrancy**: Protected via ReentrancyGuard on state-changing functions
- **Circuit Breaker**: Pausable contracts for emergency stops
- **Spending Limits**: Smart account policies for transaction amounts
- **Session TTL**: Automatic cleanup of expired sessions

---

## Architecture Highlights

### ExecFi Natural Language Pipeline
1. User inputs natural language prompt
2. AI parses intent with GPT-4o Mini (OpenRouter)
3. Intent normalized to structured transaction
4. Policy validation (limits, caps, whitelists)
5. LI.FI route planning for swaps/bridges
6. Transaction simulation for transfers
7. User confirms summary
8. Execute via Privy Smart Account (ERC-4337)
9. Monitor on-chain and display explorer link

### Signature Verification Flow
1. Frontend collects game results
2. Backend API validates and signs with EIP-712
3. Signs XP claim with XPRegistry domain
4. Returns both signatures to frontend
5. Frontend submits on-chain with signatures

### Gas Optimization
- Pull-based withdrawals in vault (Degenshoot)
- Storage packing in contracts
- Optimizer enabled (200 runs, via-IR)
- Smart Account batching for ExecFi transactions

### Multi-chain Support
- **ExecFi**: 9+ mainnets (Base, Ethereum, Polygon, Arbitrum, Optimism, Avalanche, BSC, Abstract, Lisk) and 8 testnets
- **Games**: Base mainnet/Sepolia, Lisk mainnet/testnet
- **Cross-chain**: LI.FI integration for swaps and bridges
- **Fee System**: FeeEntryPoint deployed deterministically across chains

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m ':sparkles: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention
This project uses emoji prefixes for commits:
- `:sparkles:` - New feature
- `:hammer:` - Refactor/improvement
- `:fire:` - Remove code/files
- `:bug:` - Bug fix
- `:bulb:` - Documentation
- `:whale:` - Docker/deployment

---

## License

This project is proprietary and confidential.

---

## Support

For issues, questions, or contributions, please open an issue on GitHub.

---

Built with on Base
