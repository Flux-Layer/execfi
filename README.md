# GameFi Gaming Hub

A comprehensive **Web3 gaming platform** built on the Base blockchain that combines multiple on-chain gaming experiences with unified XP/reward systems, account abstraction, and modern GameFi mechanics.

## Overview

This is a full-stack GameFi platform featuring:
- **Degenshoot** - A skill-based tile-matching game with wager mechanics
- **Greenvale** - An idle farming game with plant/water/harvest gameplay
- **Sunday Quest** - A weekly quest system for earning XP
- **Unified XP System** - Cross-game progression tracked on-chain
- **Account Abstraction** - Smart wallet support via Base Account SDK

The platform leverages EIP-712 signatures, UUPS upgradeable contracts, and a modern React frontend to deliver a seamless Web3 gaming experience.

---

## Features

### Games

#### Degenshoot (Bomb Game)
- Real-time tile-matching gameplay
- ETH wager system with multiplier-based payouts
- EIP-712 signed game results for anti-cheating
- Session-based architecture with cryptographic proofs
- XP rewards integrated with XPRegistry
- Pull-based withdrawals for winnings

#### Greenvale (Farming Game)
- Plant → Water → Harvest workflow
- ERC-1155 items (seeds, water, tools)
- ERC-721 land plots (NFTs)
- Time-based growth mechanics with tool modifiers
- Batch harvesting with single-transaction XP claiming
- P2P marketplace for trading items
- Fixed-price shop for purchasing resources

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
- **State Management**: React Query (TanStack) v5.87.4
- **Blockchain**: Wagmi v2.16.9 + Viem v2.37.8
- **Auth**: Privy v2.24.0
- **Smart Accounts**: Base Account SDK v2.4.0
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
│   │   ├── api/                # Backend API routes (41 endpoints)
│   │   │   ├── degenshoot/     # Bomb game session & signing
│   │   │   ├── farming/        # Greenvale XP signing
│   │   │   ├── sunday-quest/   # Quest verification & retrieval
│   │   │   ├── onboarding/     # Device & wallet flows
│   │   │   ├── indexer/        # Leaderboards & stats
│   │   │   └── cron/           # Scheduled tasks
│   │   └── sunday-quest/       # Sunday Quest page
│   │
│   ├── components/             # React components
│   │   ├── apps/               # Full-featured applications
│   │   │   ├── bomb/           # Degenshoot game UI
│   │   │   ├── GreenvaleGame.tsx  # Farming game UI
│   │   │   ├── Profile/        # User profile
│   │   │   └── Settings/       # Settings interface
│   │   ├── sunday-quest/       # Quest UI components
│   │   ├── onboarding/         # Onboarding flow
│   │   └── common/             # Shared components
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useGreenvaleActions.ts  # Farming contract interactions
│   │   ├── useUserXp.ts        # XP query hook
│   │   └── useSessionSigner.tsx    # Session management
│   │
│   ├── lib/                    # Utility libraries
│   │   ├── contracts/          # ABIs, addresses, domain separators
│   │   ├── games/              # Game-specific utilities
│   │   ├── indexer/            # Data aggregation
│   │   ├── sunday-quest/       # Quest system utilities
│   │   └── execute.ts          # Transaction execution
│   │
│   └── providers/              # React context providers
│
├── contracts/                  # Solidity smart contracts
│   ├── degenshoot/            # Degenshoot.sol + WagerVault.sol
│   ├── FarmingCore.sol        # Main farming game logic
│   ├── ParameterRegistry.sol  # Game configuration
│   ├── Item1155.sol           # Multi-token items
│   ├── Land721.sol            # Land NFTs
│   ├── Shop.sol               # Fixed-price shop
│   ├── Marketplace.sol        # P2P trading
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

#### Greenvale (Game ID: 2)
- **FarmingCore**: TBD
- **ParameterRegistry**: TBD
- **Item1155**: TBD
- **Land721**: TBD
- **Shop**: TBD
- **Marketplace**: TBD

#### Shared
- **XPRegistry Proxy**: `0xf77678E650a84FcA39aA66cd9EabcD1D28182035`

### Contract Architecture

```
ParameterRegistry (config hub)
    ↓
Shop, Marketplace, FarmingCore
    ↓
Item1155, Land721
    ↓
XPRegistry (rewards)
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

#### Greenvale Contracts
```bash
forge script script/DeployGreenvale.s.sol \
  --rpc-url $RPC_URL_BASE_SEPOLIA \
  --private-key $PRIVATE_KEY \
  --broadcast
```

#### Configure Greenvale
```bash
forge script script/ConfigGreenvale.s.sol \
  --rpc-url $RPC_URL_BASE_SEPOLIA \
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

# Degenshoot Contracts
NEXT_PUBLIC_DEGENSHOOT_ADDRESS=0x640b3AA6FE0B70F67535B0179b0d1d1d941aDf86
NEXT_PUBLIC_WAGER_VAULT_ADDRESS=0x75123f823ed477DA70a2F1680C0Ddb3d4E1Bb745
NEXT_PUBLIC_XP_REGISTRY_PROXY=0xf77678E650a84FcA39aA66cd9EabcD1D28182035
NEXT_PUBLIC_DEGENSHOOT_CHAIN_ID=84532
NEXT_PUBLIC_DEGENSHOOT_GAME_ID=1
GAME_SIGNER_PRIVATE_KEY=your-game-signer-key

# Greenvale Contracts
NEXT_PUBLIC_PARAMETER_REGISTRY_ADDRESS=your-param-registry
NEXT_PUBLIC_FARMING_CORE_ADDRESS=your-farming-core
NEXT_PUBLIC_ITEM1155_ADDRESS=your-item1155
NEXT_PUBLIC_LAND721_ADDRESS=your-land721
NEXT_PUBLIC_SHOP_ADDRESS=your-shop
NEXT_PUBLIC_MARKETPLACE_ADDRESS=your-marketplace
NEXT_PUBLIC_FARMING_CHAIN_ID=84532
NEXT_PUBLIC_FARMING_GAME_ID=2

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/gamefi

# Account Abstraction
NEXT_PUBLIC_ENABLE_BASE_ACCOUNT=true
NEXT_PUBLIC_BASE_ACCOUNT_APP_NAME=GameFi Hub

# Features
ONBOARDING_ENABLED=true
ONBOARDING_SKIP_ALLOWED=false
```

See `.env.sample` for the complete list of 80+ configuration options.

---

## API Routes

The backend provides 41 API endpoints organized by feature:

### Degenshoot
- `POST /api/degenshoot/sign` - Sign game result
- `POST /api/degenshoot/session/new` - Create new session
- `POST /api/degenshoot/session/restore` - Restore existing session

### Farming (Greenvale)
- `POST /api/farming/sign` - Sign XP claim

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

### Signature Verification Flow
1. Frontend collects game results
2. Backend API validates and signs with EIP-712
3. Signs XP claim with XPRegistry domain
4. Returns both signatures to frontend
5. Frontend submits on-chain with signatures

### Gas Optimization
- Batch operations for ERC-1155 transfers
- Single-transaction harvest + XP claim
- Pull-based withdrawals in vault
- Storage packing in contracts
- Optimizer enabled (200 runs, via-IR)

### Multi-chain Support
- Base mainnet
- Base Sepolia testnet
- Lisk mainnet/testnet
- LiFi for cross-chain swaps

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
