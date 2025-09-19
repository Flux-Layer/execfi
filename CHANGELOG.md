# Changelog

All notable changes to the ExecFi project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed - Smart Account Balance Validation (2025-09-19)

#### Critical Address Validation Fix
- **Fixed balance validation address mismatch** - Now validates against smart account address instead of EOA address
- **Enhanced orchestrator logic** to automatically detect and use smart account address for validation
- **Improved error handling** for funding issues vs nonce conflicts
- **Added intelligent address resolution** with fallback mechanisms

#### Technical Root Cause
- **Previous Issue**: Validation was checking EOA balance but smart account needed to hold ETH for gas fees
- **Solution**: Orchestrator now extracts smart account address from Biconomy client for validation
- **Fallback Strategy**: If smart account address unavailable, falls back to EOA with warning
- **Debug Logging**: Added comprehensive logging to track address resolution process

#### User Impact
- **Resolves "AA21 didn't pay prefund" errors** when smart account has sufficient balance
- **Accurate balance requirements** - validation now checks the correct address that will pay gas fees
- **Better error messages** distinguishing between actual insufficient funds vs validation bugs

### Added - Smart Account Info Display in Terminal (2025-09-19)

#### Enhanced Terminal Experience
- **Smart account address display** with clickable copy functionality in the terminal interface
- **Real-time token balance fetching** showing ETH balance for authenticated users
- **Interactive address copying** with visual feedback and hover states
- **Automatic balance updates** when smart account becomes available

#### New Components and API
- **SmartAccountInfo component**: Displays truncated address with copy-to-clipboard functionality
- **Balance API endpoint** (`/api/balance`): Secure server-side balance fetching using Alchemy RPC
- **Enhanced InitialText component**: Integrated smart account information display
- **Responsive error handling**: Graceful fallback for balance fetching failures

#### User Experience Improvements
- **Visual hierarchy**: Clear separation of smart account info with formatted display
- **Loading states**: Proper loading indicators during balance fetching
- **Error feedback**: User-friendly error messages for failed balance requests
- **Copy confirmation**: Visual feedback when address is copied to clipboard

#### Technical Implementation
- **Multi-chain support**: Configurable RPC endpoints for Base, Ethereum, Arbitrum, Polygon
- **Type-safe interfaces**: Comprehensive TypeScript interfaces for balance data
- **Optimized balance formatting**: Proper decimal handling and display formatting
- **Client-server coordination**: Secure API-based balance fetching with error boundaries

### Fixed - Comprehensive Nonce Conflict Resolution (2025-09-19)

#### Advanced ERC-4337 Nonce Management
- **Implemented transaction queuing system** to serialize transactions per smart account and prevent nonce collisions
- **Added bundler mempool synchronization** with extended delays for proper nonce state propagation
- **Enhanced retry mechanism** with exponential backoff (1s, 2s, 3s delays) plus additional 2s bundler sync delay
- **Comprehensive error detection** for all types of nonce conflicts including bundler-specific patterns

#### Updated Components
- **executeNativeTransfer function**: Added transaction queuing and enhanced retry logic with bundler synchronization
- **useBiconomySA hook**: Implemented per-account transaction queuing to prevent concurrent nonce issues
- **useBiconomyWithSessionKey hook**: Applied queuing to both regular and session transaction methods
- **Global transaction management**: Cross-hook coordination to prevent nonce conflicts between different transaction paths

#### ERC-4337 Specific Solutions
- **Sequential transaction processing**: Prevents multiple UserOperations with same nonce from reaching bundler mempool
- **Bundler conflict mitigation**: Added delays to prevent MEV bot exploitation and bundler race conditions
- **Smart account address-based queuing**: Each smart account maintains separate transaction queue for proper nonce ordering
- **Cross-client synchronization**: Unified nonce management across regular and session clients

#### Technical Implementation
- **Transaction queuing**: Global Map-based queue system serializing transactions per smart account address
- **Proper nonce management**: Implemented `getNonce()` method integration for fresh nonce fetching before each transaction attempt
- **Dynamic nonce specification**: Explicit nonce setting in UserOperation parameters for retry attempts to ensure consistency
- **Enhanced error detection**: Comprehensive nonce conflict identification patterns including:
  - Direct error codes (NONCE_EXPIRED, NONCE_CONFLICT)
  - Message content analysis (nonce, conflict keywords)
  - HTTP 400 status responses from Biconomy bundler
  - Network/fetch error response parsing with JSON stringification
- **Intelligent error classification**: Distinguishes between funding issues (AA21 prefund errors) and actual nonce conflicts
- **Smart retry logic**: Immediately stops retrying for funding issues while continuing retries for nonce conflicts
- **Cross-client nonce coordination**: Unified nonce fetching across regular and session smart account clients
- **Fallback nonce handling**: Graceful degradation when getNonce method is unavailable with automatic nonce management
- **Bundler mempool awareness**: Extended delays (2s + exponential backoff) for mempool synchronization
- **Memory management**: Automatic cleanup of completed/failed transactions from queue
- **Debug logging**: Comprehensive error analysis with full error object inspection and nonce state tracking

### Added - Session Key Automated Signing (2025-09-19)

#### Session Key Infrastructure
- **Implemented session key creation and management** for automated transaction signing
- **Added automated transaction flow** that bypasses user approval for signed sessions
- **Created secure session storage** with configurable expiration times
- **Built session key wallet client** for seamless transaction execution

#### New Components and Hooks
- **useSessionKey hook**: Session key lifecycle management with localStorage persistence
  ```typescript
  const { sessionKey, createSessionKey, isSessionActive } = useSessionKey();
  ```
- **useBiconomyWithSessionKey hook**: Enhanced smart account client with session capabilities
  ```typescript
  const { createSession, sendTxWithSession } = useBiconomyWithSessionKey();
  ```
- **Session-enabled transaction execution**: Updated executeTransferPipeline with session support

#### User Experience Improvements
- **Updated smart-account page** with session key demonstration interface
- **Added session status indicators** and automated transaction testing
- **Created example implementations** for automated DeFi operations and batch transactions
- **Implemented session expiration handling** with automatic cleanup

#### Technical Implementation
- **Session key generation**: Uses viem's generatePrivateKey for secure key creation
- **Time-based expiration**: Configurable session duration with automatic expiration
- **Dual client architecture**: Maintains both regular and session-enabled smart account clients
- **Transaction routing**: Automatic selection between user-approved and session transactions

#### Security Features
- **24-hour default expiration** for session keys
- **Automatic session cleanup** on expiration
- **Client-side session storage** with no server-side key persistence
- **Session validation** before each automated transaction

#### Complete Prompt-to-Transaction Session Flow
- **Enhanced AI intent processing** to detect session keywords (`auto`, `automatically`, `without approval`, `session`)
- **Extended transaction schema** with optional `useSession` boolean field
- **Updated orchestrator pipeline** to handle session context and client selection
- **Created SessionEnabledTerminal** with full session management and status indicators
- **Integrated session support** into main application flow

#### Natural Language Session Commands
```
// Create session
"create session"

// Automated transactions
"auto transfer 0.001 ETH to 0x..."
"automatically send 10 USDC to vitalik.eth"
"transfer 0.001 ETH to 0x... without approval"
"session transfer 0.001 ETH to 0x..."

// Regular transactions (still work)
"transfer 0.001 ETH to 0x..."
```

#### Example Usage
```typescript
// Create a session for automated signing
await createSession(24); // 24 hours

// Send transaction automatically without user approval
const hash = await sendTxWithSession({
  to: "0x742D35Cc6234B8D4d1d58FC5c3F6b5BD2c47a31B",
  value: "1000000000000000" // 0.001 ETH
});

// Full orchestration with session support
const result = await executeTransactionFromPrompt(
  "auto transfer 0.001 ETH to 0x...",
  userId,
  biconomyClient,
  userAddress,
  { sessionClient, hasActiveSession: true }
);
```

### Fixed - AbstractJS Transaction Execution API (2025-09-17 15:00 UTC)

#### Critical Transaction Flow Fix
- **Fixed "Invalid response from Biconomy client - missing wait method" error** by implementing correct AbstractJS API pattern
- **Updated transaction execution** from legacy `sendTransaction` to AbstractJS `sendUserOperation` pattern
- **Implemented proper receipt handling** using `waitForUserOperationReceipt` method
- **Resolved API mismatch** between expected Biconomy v3 pattern and actual AbstractJS v4 API

#### Technical Changes
- **Updated useBiconomySA.tsx sendTx method**:
  ```typescript
  // ❌ Old: const { wait } = await client.sendTransaction({...});
  // ✅ New: const hash = await client.sendUserOperation({ calls: [{...}] });
  //         const receipt = await client.waitForUserOperationReceipt({ hash });
  ```
- **Updated execute.ts transaction flow**:
  ```typescript
  // ❌ Old: const result = await biconomyClient.sendTransaction(txParams);
  // ✅ New: const hash = await biconomyClient.sendUserOperation({ calls: [...] });
  //         const receipt = await biconomyClient.waitForUserOperationReceipt({ hash });
  ```
- **Enhanced client validation** to check for `sendUserOperation` and `waitForUserOperationReceipt` methods
- **Improved error handling** specific to AbstractJS user operation patterns
- **Updated success validation** to use AbstractJS receipt structure

#### AbstractJS API Compliance
- **Calls pattern**: Transactions now use `calls` array format as required by AbstractJS
- **Hash-based waiting**: Proper hash-based receipt polling instead of legacy wait method
- **Receipt extraction**: Correctly extract transaction hash from user operation receipt
- **Error codes**: Updated error codes to reflect user operation vs transaction distinction

### Fixed - AbstractJS getAddress Method Compatibility (2025-09-17 14:30 UTC)

#### Critical Method Call Fix
- **Fixed "e.getAddress is not a function" error** in transaction execution
- **Updated address retrieval pattern** to use AbstractJS client structure instead of legacy getAddress() method
- **Enhanced parameter passing** to provide userAddress to execution functions
- **Maintained logging compatibility** with smart account address display

#### Technical Changes
- **Updated executeNativeTransfer()** to accept optional userAddress parameter
- **Modified executeTransferPipeline()** to pass userAddress from orchestration context
- **Fixed address resolution pattern**:
  ```typescript
  // ❌ Old: const saAddress = await biconomyClient.getAddress();
  // ✅ New: const saAddress = userAddress || biconomyClient.account?.address || "unknown";
  ```
- **Maintained backward compatibility** for logging and debugging output

### Fixed - Biconomy v4 AbstractJS Migration (2025-09-17 14:15 UTC)

#### Critical SDK Migration - Biconomy v3 → v4 AbstractJS
- **Fixed "undefined has no properties" error** by migrating from legacy Biconomy v3 SDK to v4 AbstractJS
- **Updated smart account creation** to use `toNexusAccount` with proper `chainConfiguration` pattern
- **Migrated transaction execution** to use Nexus smart account client pattern
- **Resolved API compatibility issues** that were causing transaction failures after token selection

#### Package Dependencies
- **Replaced legacy packages**:
  - ❌ `@biconomy/account@^4.5.7`
  - ❌ `@biconomy/bundler@^3.1.4`
  - ❌ `@biconomy/paymaster@^3.1.4`
  - ❌ `@biconomy/use-aa@^1.1.1`
  - ✅ `@biconomy/abstractjs@^1.1.6` (unified SDK)

#### Smart Account Implementation Updates
- **New Nexus account creation pattern**:
  ```typescript
  const nexusAccount = await toNexusAccount({
    signer: viemSigner,
    chainConfiguration: {
      chain,
      transport: http(rpcUrl),
      version: getMEEVersion(MEEVersion.V2_1_0)
    }
  });
  ```
- **Updated smart account client**:
  ```typescript
  const saClient = createSmartAccountClient({
    account: nexusAccount,
    transport: http(bundlerUrl)
  });
  ```
- **Removed manual validation module setup** (Nexus handles internally)
- **Simplified provider architecture** (AbstractJS doesn't require provider wrapper)

#### Transaction Execution
- **Maintained compatible transaction pattern** that works with both v3 and v4:
  ```typescript
  const { wait } = await client.sendTransaction({...});
  const { receipt: { transactionHash }, success } = await wait();
  ```
- **Enhanced error handling** with detailed transaction response validation
- **Improved debugging output** for better error diagnosis

#### Architecture Improvements
- **Removed legacy BiconomyProvider** dependency from `@biconomy/use-aa`
- **Updated imports** to use unified AbstractJS SDK exports
- **Fixed TypeScript compilation** with correct v4 type definitions
- **Maintained backward compatibility** for existing transaction flows

### Fixed - Biconomy Transaction Execution (2025-09-17 17:30 UTC)

#### Critical API Fix - Biconomy SDK Integration
- **Fixed 404 "unknown error" in sendTransaction** by correcting Biconomy SDK usage
- **Updated transaction execution flow** to use proper `{ wait }` pattern from Biconomy v3
- **Added paymaster URL support** for optional gas sponsorship in smart account creation
- **Enhanced error handling** for HTTP status codes (404, 401, 403) and API endpoint issues

#### Biconomy SDK Compliance
- **Correct sendTransaction pattern**:
  ```typescript
  const { wait } = await client.sendTransaction({ to, value, data });
  const { receipt: { transactionHash }, success } = await wait();
  ```
- **Proper client initialization**: Added `paymasterUrl` parameter to `createSmartAccountClient`
- **Transaction waiting**: Uses built-in `wait()` function for transaction confirmation
- **Success validation**: Checks `success` flag before returning transaction hash

#### Enhanced Error Handling
- **HTTP 404 errors**: "Biconomy API endpoint not found. Please check bundler URL configuration"
- **Authentication errors**: Specific messages for 401/403 API authentication issues
- **Transaction failure detection**: Checks `success` flag and throws appropriate errors
- **Bundler/Paymaster errors**: Maintained existing Biconomy-specific error handling

#### Technical Implementation
- **Updated useBiconomySA hook**: Corrected `sendTx` function to use proper Biconomy API
- **Updated execute.ts**: Fixed `executeNativeTransfer` to follow Biconomy SDK patterns
- **API endpoint validation**: Added checks for bundler URL configuration issues
- **Transaction confirmation**: Uses native Biconomy transaction waiting instead of custom polling

### Fixed - Native ETH Transaction Continuation (2025-09-17 17:15 UTC)

#### Critical Fix - Native ETH Selection Flow
- **Fixed native ETH transaction blocking** after token selection
- **Added intelligent token type detection** - distinguishes native ETH vs ERC-20 after selection
- **Implemented transaction continuation** for native ETH selections from token table
- **Enhanced user feedback** with "🔄 Proceeding with native ETH transfer..." message

#### Transaction Flow Improvements
- **Native ETH detection**: Checks if selected token address is `0x0000000000000000000000000000000000000000`
- **Automatic transaction continuation**: Re-executes orchestrator with native ETH when selected
- **Prompt normalization**: Ensures ETH is uppercase for proper native token detection
- **Full pipeline integration**: Complete transaction execution including explorer links

#### User Experience Enhancement
- **No more false ERC-20 blocking**: Native ETH selections now proceed to actual transactions
- **Clear progress indication**: Shows "Proceeding with native ETH transfer..." status
- **Proper success flow**: Displays transaction hash and explorer link for native ETH
- **ERC-20 preservation**: Still shows "not implemented" message for actual ERC-20 tokens

#### Technical Implementation
- **Token address comparison**: Uses `selectedToken.address === "0x0000000000000000000000000000000000000000"`
- **Orchestrator re-execution**: Calls `executeTransactionFromPrompt` with normalized prompt
- **Error handling preservation**: Maintains all existing error handling for the continuation flow
- **State management**: Proper cleanup of token selection state after continuation

### Fixed - Token Selection Input Handling (2025-09-17 17:00 UTC)

#### Critical UX Fix - Token Selection Flow
- **Fixed infinite clarification loop** that occurred after token table display
- **Added token selection state management** to properly handle user input for token selection
- **Implemented numerical token selection** - users can now enter 1, 2, 3, etc. to select tokens
- **Added input validation** for token selection with clear error messages for invalid selections
- **Enhanced terminal command context** - shows "select-token" prompt when waiting for selection

#### Token Selection User Experience
- **Clear selection prompt**: "Please enter the number of the token you want to use:"
- **Input validation**: Shows error for invalid numbers or out-of-range selections
- **Selection confirmation**: "✅ Selected: Token Name (SYMBOL)" feedback
- **Graceful state management**: Properly clears selection state after choice
- **Future-ready architecture**: Framework in place for continuing with selected token

#### Technical Implementation
- **Added tokenSelectionState** in TerminalBody component to track selection status
- **Enhanced handleSubmitLine** to route input to token selection handler when appropriate
- **State management**: Tracks originalPrompt, availableTokens, and selection status
- **Command context switching**: Dynamic command prop based on current terminal state
- **Clean state transitions**: Properly clears selection state after user choice

### Added - Token Selection System (2025-09-17 16:45 UTC)

#### Enhanced Token Recognition and Selection
- **Added token registry system** for Base and Base Sepolia with common tokens (ETH, USDC, WETH, DAI)
- **Implemented intelligent token matching** with fuzzy search by symbol and name
- **Added token disambiguation flow** when multiple tokens match user input
- **Enhanced AI prompt parsing** to support both native ETH and ERC-20 token intents

#### Token Selection Terminal Integration
- **Added token table display** in terminal for ambiguous token matches
- **Enhanced terminal types** to support token-table content type with clickable token selection
- **Integrated token selection flow** into orchestration pipeline
- **Added support for token selection response** type in terminal handlers

#### Robust Token Resolution Architecture
- **Extended normalization layer** to handle both native and ERC-20 token intents
- **Created TokenSelectionError** for graceful handling of ambiguous token requests
- **Enhanced orchestrator** to catch and properly format token selection requests
- **Updated validation layer** with routing for different intent types

#### Token Database and Search Features
- **Base Sepolia token registry**: ETH, USDC, WETH, DAI, ETC with verification status
- **Base mainnet token registry**: ETH, USDC, WETH with production addresses
- **Smart token search algorithm**: exact matches → partial matches → name matches
- **Token verification indicators**: visual checkmarks for verified tokens in terminal table

#### User Experience Improvements
- **Clear token selection prompt**: "Found X tokens matching 'symbol' on Chain. Please select:"
- **Numbered token table**: ID, Logo, Name, Symbol, Network, Address columns
- **Verified token indicators**: green checkmarks for trusted tokens
- **Future-ready architecture**: extensible for cross-chain token support

#### Architecture and Type Safety
- **Enhanced AI schema** to support discriminated union of native/ERC-20 token types
- **Updated normalization types** with NormalizedERC20Transfer support
- **Extended orchestration responses** with OrchestrationTokenSelection type
- **Comprehensive error handling** for all token resolution scenarios

#### MVP Limitations and Future Enhancements
- **Token display only**: Token selection shows table but execution falls back to native ETH
- **ERC-20 execution**: Not implemented in MVP - shows "ERC-20 not yet supported" message
- **Ready for implementation**: Full architecture in place for ERC-20 transaction execution
- **Cross-chain ready**: Token registry extensible to other supported chains

### Fixed - Balance Validation and Error Handling (2025-09-17 16:15 UTC)

#### Enhanced Validation Layer - Improved Balance Checking
- **Fixed gas estimation error for insufficient balance** by reordering validation steps
- **Added early balance check** before gas estimation to prevent "Failed to estimate gas" errors
- **Improved error messages** for insufficient balance scenarios with detailed breakdown
- **Enhanced error categorization** in orchestrator for better phase-based error mapping

#### Validation Flow Improvements
- **Implemented `checkBasicBalance()`** function to validate transfer amount before gas operations
- **Enhanced `validateBalance()`** to accept pre-fetched balance and provide detailed cost breakdown
- **Added specific error codes** for different balance scenarios:
  - `INSUFFICIENT_FUNDS` - balance less than transfer amount
  - `INSUFFICIENT_FUNDS_WITH_GAS` - balance insufficient for transfer + gas costs
  - `BALANCE_TOO_LOW_AFTER_TX` - remaining balance below minimum threshold
- **Updated orchestrator error mapping** to properly categorize validation errors by phase

#### User Experience Enhancements
- **Clear error messaging** - users now see exact balance vs required amounts
- **Gas cost transparency** - error messages show transfer amount + gas cost breakdown
- **Phase-specific error indicators** - validation errors show ⚖️ emoji in terminal
- **Maintained existing minimum balance policy** (0.001 ETH after transaction)

#### Code Quality
- **Cleaned up unused variables** in validation error handling
- **Optimized import statements** in terminal components
- **Maintained zero compilation errors** - application builds successfully
- **Enhanced type safety** for error code categorization

### Fixed - Terminal Integration and Build Issues (2025-09-17 15:30 UTC)

#### Critical UX Fix - Restored Login Functionality
- **Fixed broken authentication flow** by reverting to original `PromptTerminal` component
- **Integrated execution pipeline** into existing terminal that supports both login and transactions
- **Preserved login flow** - users can now authenticate via email/OTP from terminal as before
- **Enhanced authenticated flow** - after login, terminal uses full orchestration pipeline for transactions
- **Fixed terminal rendering condition** - no longer shows PageBarLoader forever for unauthenticated users

#### Terminal Integration Improvements
- **Added explorer-link support** to ChatHistory component with clickable blockchain explorer links
- **Dynamic orchestrator imports** to avoid SSR issues during transaction execution
- **Integrated full execution pipeline** into existing terminal architecture without breaking existing functionality
- **Enhanced error handling** for OrchestrationError and IdempotencyError types
- **Cleaned up unused imports** to reduce ESLint warnings in terminal components

#### Build Compilation Issues

#### TypeScript Configuration Updates
- **Fixed BigInt literal compilation error** by upgrading TypeScript target from ES2017 to ES2020
- Resolved "BigInt literals are not available when targeting lower than ES2020" error
- Confirmed ES2020 target is safe for existing codebase and modern deployment environments

#### Code Quality Improvements
- **Cleaned unused variables** in execution pipeline modules:
  - Fixed unused `error` parameters in catch blocks (normalize.ts, validation.ts)
  - Fixed unused function parameters in execute.ts and validation.ts
  - Removed unused imports in orchestrator.ts
  - Fixed unused variables in explorer.ts
- Enhanced code maintainability and reduced ESLint warnings

#### Build Status
- ✅ **Zero compilation errors** - application builds successfully for production
- ✅ **TypeScript strict mode compliance** maintained throughout execution pipeline
- ✅ **Bundle optimization** - all routes generate optimized production bundles
- ✅ **ES2020 compatibility** - enables BigInt literals for cleaner BigInt operations

### Added - MVP Execution Pipeline (2025-09-17 14:00 UTC)

#### Core Execution Pipeline Implementation

**New Libraries & Dependencies**
- Added `zod@^4.1.9` for schema validation with `--legacy-peer-deps` to handle Privy/Biconomy compatibility

**AI Intent Processing** (Already existed, enhanced)
- Enhanced existing `/src/lib/ai/` layer with proper TypeScript exports
- Validated existing OpenRouter integration with strict JSON contracts
- Confirmed Zod schema validation for Intent v1.1 format

**Normalization Layer** - `/src/lib/normalize.ts`
- Implemented `normalizeIntent()` for converting AI intents to internal format
- Added chain resolution mapping (base/baseSepolia � chainId)
- Implemented `NormalizedNativeTransfer` type with strict validation
- Added support for MAX amount resolution with balance-aware calculation
- Enhanced address validation with EIP-55 checksumming via Viem
- Added comprehensive error handling with typed `NormalizationError`

**Validation Layer** - `/src/lib/validation.ts`
- Implemented `validateNativeTransfer()` with comprehensive policy enforcement
- Added real-time balance checking via Viem public clients
- Implemented gas estimation with 110% headroom buffer
- Added transaction amount limits and daily spend policy enforcement
- Implemented transaction simulation for pre-flight validation
- Added support for Base mainnet (8453) and Base Sepolia (84532)
- Enhanced error taxonomy with actionable user messages

**Execution Layer** - `/src/lib/execute.ts`
- Implemented `executeNativeTransfer()` via Biconomy Smart Account clients
- Added comprehensive error mapping for Biconomy-specific failures
- Implemented transaction confirmation waiting with timeout handling
- Added `executeTransferPipeline()` orchestrator for full execution flow
- Enhanced logging and debugging for transaction lifecycle
- Added smart account deployment detection and handling

**Explorer Integration** - `/src/lib/explorer.ts`
- Implemented blockchain explorer URL generation for Base/BaseScan
- Added `formatSuccessMessage()` with standard UX copy per CLAUDE.md spec
- Added `generateExplorerLink()` for clickable terminal integration
- Implemented address/transaction hash shortening utilities
- Added support for future multi-chain explorer configuration

**Idempotency Guard** - `/src/lib/idempotency.ts`
- Implemented in-memory duplicate detection with 60-second time windows
- Added deterministic prompt ID generation via transaction details hashing
- Implemented automatic cleanup of expired idempotency entries
- Added transaction status tracking (pending/completed/failed)
- Enhanced duplicate detection with user-friendly error messages
- Added store statistics for debugging and monitoring

**Main Orchestrator** - `/src/lib/orchestrator.ts`
- Implemented full pipeline orchestration following AGENTS.md state machine
- Added `orchestrateTransaction()` with comprehensive error handling
- Implemented phase-based error mapping (intent/normalize/validate/execute)
- Added `OrchestrationResponse` union type for success/clarification flows
- Enhanced logging with detailed phase tracking for debugging
- Added `executeTransactionFromPrompt()` convenience wrapper

#### Terminal Integration

**New Execution Terminal** - `/src/components/terminal/ExecutionTerminal.tsx`
- Created simplified terminal interface focused on transaction execution
- Integrated full orchestration pipeline with real-time feedback
- Added visual transaction status with spinner and confirmation messages
- Implemented clickable explorer links in terminal output
- Added comprehensive error display with emoji-based phase indicators
- Enhanced UX with Smart Account address display and initialization status

**Main Page Integration** - `/src/app/page.tsx`
- Updated to use new `ExecutionTerminal` component
- Added authentication gate to ensure proper Privy/Biconomy readiness
- Simplified component hierarchy for better performance

#### Configuration & Environment

**Enhanced Environment Variables**
- Confirmed `OPENROUTER_API_KEY` for AI intent parsing
- Validated `NEXT_PUBLIC_BICONOMY_API_KEY` for Smart Account operations
- Confirmed `NEXT_PUBLIC_ALCHEMY_KEY` for RPC connectivity
- Added policy configuration via environment variables:
  - `MAX_TX_AMOUNT_ETH` (default: 1.0 ETH)
  - `DAILY_SPEND_LIMIT_ETH` (default: 5.0 ETH)
  - `GAS_HEADROOM_MULT` (default: 1.1)
  - `MIN_BALANCE_AFTER_TX_ETH` (default: 0.001 ETH)

#### Architecture Compliance

**INITIAL.md Specification Compliance**
-  **Phase A (AI layer)**: Enhanced existing implementation with proper exports
-  **Phase B (Normalization & validation)**: Fully implemented with Viem integration
-  **Phase C (AA wiring)**: Leveraged existing Biconomy hook with enhanced error handling
-  **Phase D (Orchestrator glue)**: Complete pipeline implementation
-  **Phase E (Terminal integration)**: New ExecutionTerminal with full pipeline
-  **Phase F (Explorer helpers)**: BaseScan integration with clickable links

**AGENTS.md State Machine Implementation**
- Implemented full state machine: START � INTENT � NORMALIZE � VALIDATE � PLAN � SIMULATE � EXECUTE � MONITOR
- Added proper error backoff and retry logic per specification
- Implemented clarification flow for ambiguous user intents
- Added comprehensive error taxonomy mapping

**CLAUDE.md Contract Compliance**
- Maintained strict TypeScript typing throughout
- Followed Viem integration patterns for blockchain operations
- Implemented deterministic error handling over heuristics
- Added detailed changelog documentation (this file)
- Maintained non-custodial architecture with client-side key management

### Technical Debt Addressed

**Type Safety**
- Eliminated `any` types in orchestration pipeline
- Added comprehensive TypeScript interfaces for all data flows
- Enhanced error typing with discriminated unions

**Error Handling**
- Implemented typed error hierarchy with specific error codes
- Added user-friendly error messages following UX contract
- Enhanced debugging with phase-based error categorization

**Performance**
- Implemented efficient in-memory idempotency store with automatic cleanup
- Added transaction simulation to avoid failed on-chain transactions
- Enhanced gas estimation accuracy with real-time network data

### Security Enhancements

**Transaction Safety**
- Added comprehensive balance validation before execution
- Implemented transaction amount limits and daily spending caps
- Added address validation with EIP-55 checksumming
- Enhanced duplicate transaction prevention

**Non-Custodial Compliance**
- Maintained client-side key management via Privy/Biconomy
- Added proper Smart Account deployment detection
- Implemented secure idempotency without exposing sensitive data

### Known Limitations (MVP Scope)

**Features Not Implemented**
- ERC-20 token transfers (future enhancement)
- Cross-chain swaps/bridges via LI.FI (future enhancement)
- ENS name resolution (returns error with helpful message)
- Persistent idempotency store (using in-memory for MVP)
- Advanced transaction confirmation polling (simplified for MVP)

**Testing Status**
- Unit tests: Not implemented (requires future work)
- Integration tests: Not implemented (requires testnet setup)
- E2E tests: Manual testing only

### Breaking Changes

**Terminal Interface**
- Replaced `PromptTerminal` with `ExecutionTerminal` in main page
- New component has different props interface (simplified)

### Migration Guide

**For Developers**
- Import orchestration functions from `/src/lib/orchestrator.ts`
- Use `executeTransactionFromPrompt()` for simple transaction execution
- Handle `OrchestrationResponse` union type for success/clarification flows

**For Users**
- Terminal now requires authentication before accepting commands
- Smart Account initialization must complete before transactions
- Error messages are more specific and actionable

---

## [0.1.0] - 2025-09-17 13:00 UTC

### Added
- Initial project setup with Next.js 15, TypeScript, and Tailwind CSS
- Privy authentication integration with email/OTP flow
- Biconomy Smart Account integration with ERC-4337 support
- Basic terminal UI components
- OpenRouter AI integration for intent parsing
- Foundational project documentation (CLAUDE.md, INITIAL.md, AGENTS.md)

### Security
- Non-custodial architecture with client-side key management
- Smart Account deployment via Biconomy bundler infrastructure