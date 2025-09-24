# PRP: Native ETH Transfer on Base using Privy Smart Accounts

**Project:** ExecFi - Prompt→Transaction DeFi App
**Feature:** Native ETH transfers on Base using Privy Smart Accounts (ERC-4337)
**Target Environment:** Base mainnet (8453) + Base Sepolia (84532)
**PRP Version:** 1.0
**Date:** 2025-09-24

---

## Executive Summary

This PRP defines the complete implementation plan for enabling native ETH transfers on Base blockchain using Privy Smart Accounts. The feature allows users to input natural language prompts like "transfer 0.002 ETH on base to 0x..." which are parsed by an AI agent, validated, and executed through the user's Privy Smart Account.

**Key Success Metrics:**
- Terminal prompt → successful transaction ≤ 8 seconds on testnets
- AI intent parsing ≤ 2.5 seconds (Claude Sonnet via OpenRouter)
- Zero server-side key custody (non-custodial architecture)
- Smart Account auto-deployment on first transaction
- Comprehensive error handling with actionable user feedback

---

## Technical Architecture Overview

### Core Components Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Terminal UI   │    │  AI Intent      │    │  Privy Smart    │
│   (React)       │───▶│  Parser         │───▶│  Account        │
│                 │    │  (OpenRouter)   │    │  (ERC-4337)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  UX Feedback    │    │  Normalization  │    │  Base Network   │
│  & Explorer     │    │  & Validation   │    │  (8453/84532)   │
│  Links          │    │  Engine         │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Data Flow State Machine

```
User Prompt → Intent Parsing → Normalization → Validation → Simulation → Execution → Monitoring
     │              │               │              │              │             │           │
     ▼              ▼               ▼              ▼              ▼             ▼           ▼
  Terminal     JSON Schema     Chain/Token    Policy/Balance   Gas/Quote    Smart Acct  Explorer
   Input       Validation      Resolution     Enforcement      Checks       Transaction    Link
                    │              │              │              │             │
                    ▼              ▼              ▼              ▼             ▼
                 Clarify      CHAIN_UNSUPPORTED  INSUFFICIENT  SIMULATION   BUNDLER_REJECTED
                Question     TOKEN_UNKNOWN      FUNDS         FAILED       or SUCCESS
```

### Technology Stack

- **Frontend:** React 19.1.0 + Next.js 15.5.2 (App Router)
- **Smart Account:** Privy Smart Accounts (@privy-io/react-auth ^2.24.0)
- **Blockchain:** Viem ^2.37.8 for chain utilities
- **AI Processing:** OpenRouter API (Claude Sonnet) via server-side API
- **Validation:** Zod ^4.1.9 for schema validation
- **Styling:** TailwindCSS ^4.0
- **State Management:** React hooks + Privy auth context

---

## Detailed Implementation Plan

### Phase 1: AI Intent Processing Layer

#### File Structure:
```
src/lib/ai/
├── intent.ts        # OpenRouter API integration
├── schema.ts        # Zod validation schemas (✅ exists)
├── parse.ts         # JSON sanitization utilities
└── prompts.ts       # AI system prompts
```

#### Core Implementation:

**1.1 Enhanced Intent Parser** (`src/lib/ai/intent.ts`)
```typescript
export async function parseIntent(prompt: string): Promise<Intent> {
  const response = await fetch('/api/intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });

  const rawOutput = await response.text();
  const sanitized = sanitizeAiJson(rawOutput);
  return validateIntent(JSON.parse(sanitized));
}
```

**1.2 JSON Sanitization** (`src/lib/ai/parse.ts`)
```typescript
export function sanitizeAiJson(raw: string): string {
  // Remove markdown code fences
  // Strip non-JSON content
  // Handle common AI output quirks
}
```

**1.3 API Route Enhancement** (`src/app/api/intent/route.ts`)
- OpenRouter integration with Claude Sonnet
- Temperature=0 for deterministic output
- Strict JSON-only response enforcement
- Retry logic for off-policy responses

### Phase 2: Normalization & Validation Engine

#### Enhanced Normalization (`src/lib/normalize.ts` - ✅ exists, needs updates)

**Updates needed:**
- Add support for MAX amount resolution with balance checking
- Enhanced error messaging for better UX
- ENS name resolution preparation (placeholder)

**2.1 MAX Amount Resolution**
```typescript
export async function resolveMaxAmount(
  intent: TransferIntent,
  smartAccountAddress: `0x${string}`,
  chainId: number
): Promise<string> {
  const balance = await getBalance(smartAccountAddress, chainId);
  const gasEstimate = await estimateGas(...);
  const maxAmount = balance - (gasEstimate * 110n / 100n);
  return formatEther(maxAmount);
}
```

#### Enhanced Validation (`src/lib/validation.ts` - ✅ exists, needs updates)

**Updates needed:**
- Smart Account address integration
- Enhanced balance checking with gas headroom
- Policy enforcement improvements

### Phase 3: Privy Smart Account Integration

#### File Structure:
```
src/hooks/
├── useSmartWallet.tsx    # ✅ exists, needs completion
└── usePrivyExecution.ts  # New: execution wrapper

src/lib/
├── execute.ts           # Smart Account execution logic
└── monitor.ts           # Transaction monitoring
```

#### Core Implementation:

**3.1 Enhanced Smart Wallet Hook** (`src/hooks/useSmartWallet.tsx`)
```typescript
export default function useSmartWallet() {
  const { user, ready } = usePrivy();
  const { client: smartWalletClient } = useSmartWallets();

  // Current implementation needs return statement
  return {
    smartWallet: smartWallet,
    smartWallets: smartWallets,
    smartWalletClient,
    smartAccountAddress: smartWallet?.address as `0x${string}` | undefined,
    isReady: ready && !!smartWallet && !!smartWalletClient
  };
}
```

**3.2 Execution Engine** (`src/lib/execute.ts`)
```typescript
export async function executeNativeTransfer(
  client: SmartAccountClient,
  norm: NormalizedNativeTransfer
): Promise<string> {
  const txHash = await client.sendUserOperation({
    to: norm.to,
    value: norm.amountWei,
    data: '0x'
  });

  return txHash;
}
```

**3.3 Transaction Monitor** (`src/lib/monitor.ts`)
```typescript
export async function monitorTransaction(
  txHash: string,
  chainId: number
): Promise<TransactionReceipt> {
  // Poll for transaction confirmation
  // Return receipt with status
}
```

### Phase 4: Terminal UI Integration

#### Enhanced Components:

**4.1 Terminal Execution Flow** (`src/components/terminal/TerminalBody.tsx`)
- Integrate with intent parsing pipeline
- Add execution status indicators
- Implement spinner states and success/error messaging

**4.2 Smart Account Info Display** (`src/components/terminal/SmartAccountInfo.tsx`)
- Show Smart Account address
- Display current balance
- Indicate deployment status

### Phase 5: Utility & Support Systems

#### File Structure:
```
src/lib/
├── idempotency.ts    # ✅ exists, needs enhancement
├── explorer.ts       # ✅ exists, ready
├── registry.ts       # Chain/token registry
└── telemetry.ts      # Logging & monitoring
```

**5.1 Idempotency System Enhancement**
- Implement 60-second duplicate prevention
- Hash-based prompt identification
- In-memory storage for MVP

**5.2 Telemetry Integration**
```typescript
export function logTransactionAttempt(data: {
  userId: string;
  smartAccountAddress: string;
  promptId: string;
  intent: NormalizedIntent;
  status: 'success' | 'error';
  txHash?: string;
  error?: string;
}) {
  // No secrets logging
  // Optional Sentry integration
}
```

---

## Step-by-Step Development Phases

### Phase 1: Foundation (Days 1-2)
1. **AI Pipeline Completion**
   - Complete `/src/lib/ai/parse.ts` with JSON sanitization
   - Enhance `/src/app/api/intent/route.ts` with OpenRouter integration
   - Add system prompts in `/src/lib/ai/prompts.ts`
   - Unit tests for intent parsing

2. **Schema Validation**
   - Validate existing Zod schemas in `/src/lib/ai/schema.ts`
   - Add comprehensive error handling
   - Test edge cases (missing fields, malformed JSON)

3. **Terminal Integration**
   - Wire AI pipeline to terminal components
   - Implement clarify question flow
   - Add loading states and error display

### Phase 2: Smart Account Wiring (Days 3-4)
1. **Hook Completion**
   - Complete `useSmartWallet.tsx` return statement
   - Add readiness checks and error states
   - Implement Smart Account address retrieval

2. **Execution Engine**
   - Build `/src/lib/execute.ts` with Privy Smart Account integration
   - Implement native ETH transfer logic
   - Add error handling for bundler rejections

3. **Validation Integration**
   - Update validation.ts to work with Smart Account addresses
   - Integrate MAX amount resolution
   - Add comprehensive balance checking

4. **Base Sepolia Testing**
   - Deploy to Base Sepolia testnet
   - Test Smart Account deployment
   - Validate end-to-end transfer flow

### Phase 3: Polish & Production Readiness (Day 5)
1. **Monitoring & Feedback**
   - Implement transaction monitoring
   - Add explorer link generation
   - Enhance success/error messaging

2. **Idempotency & Safety**
   - Complete idempotency system
   - Add per-transaction limits
   - Implement confirmation gates (optional)

3. **Testing & Documentation**
   - Comprehensive test suite (unit + integration)
   - End-to-end testing on Base Sepolia
   - Documentation and error taxonomy

4. **Production Deployment**
   - Environment configuration for Base mainnet
   - Feature flags for gradual rollout
   - Monitoring and alerting setup

---

## Testing Strategy

### Unit Tests (Vitest + Testing Library)

**AI Layer Tests:**
```typescript
// src/lib/ai/__tests__/parse.test.ts
describe('JSON Sanitization', () => {
  test('removes markdown fences', () => {
    const input = '```json\n{"ok": true}\n```';
    expect(sanitizeAiJson(input)).toBe('{"ok": true}');
  });

  test('handles malformed AI output', () => {
    const input = 'Here is the JSON: {"ok": true} - hope this helps!';
    expect(() => sanitizeAiJson(input)).toThrow('OFF_POLICY_JSON');
  });
});
```

**Normalization Tests:**
```typescript
// src/lib/__tests__/normalize.test.ts
describe('Intent Normalization', () => {
  test('normalizes base chain correctly', () => {
    const intent = { action: 'transfer', chain: 'base', /* ... */ };
    const result = normalizeTransferIntent(intent);
    expect(result.chainId).toBe(8453);
  });

  test('handles MAX amount', () => {
    // Test MAX amount handling
  });

  test('validates addresses', () => {
    // Test address validation and checksumming
  });
});
```

**Validation Tests:**
```typescript
// src/lib/__tests__/validation.test.ts
describe('Balance Validation', () => {
  test('rejects insufficient balance', async () => {
    // Mock low balance scenario
    await expect(validateNativeTransfer(norm, address))
      .rejects.toThrow('INSUFFICIENT_FUNDS');
  });

  test('includes gas in balance check', async () => {
    // Test gas headroom calculation
  });
});
```

### Integration Tests (Base Sepolia)

**Smart Account Integration:**
```typescript
describe('Smart Account Integration', () => {
  test('deploys smart account on first transaction', async () => {
    // Test auto-deployment
  });

  test('executes native transfer', async () => {
    // Test full transfer flow
  });

  test('handles bundler errors', async () => {
    // Test error scenarios
  });
});
```

### End-to-End Tests

**Terminal Flow:**
```typescript
describe('Terminal E2E', () => {
  test('completes transfer from prompt to explorer link', async () => {
    // Full user journey test
    // Prompt input → AI parsing → validation → execution → success
  });

  test('handles clarify questions', async () => {
    // Test incomplete prompts
  });

  test('shows actionable errors', async () => {
    // Test error scenarios
  });
});
```

---

## Risk Assessment and Mitigation

### High-Risk Areas

**1. AI Output Reliability**
- **Risk:** LLM produces malformed JSON or off-policy responses
- **Mitigation:**
  - Strict schema validation with Zod
  - JSON sanitization preprocessing
  - Retry mechanism for failed parses
  - Temperature=0 for determinism

**2. Smart Account Deployment**
- **Risk:** First transaction may fail due to deployment complexity
- **Mitigation:**
  - Comprehensive gas estimation including deployment costs
  - Clear user messaging about first-transaction behavior
  - Fallback error handling and retry mechanisms

**3. Gas Price Volatility**
- **Risk:** Gas price spikes could cause insufficient balance errors
- **Mitigation:**
  - Real-time gas price fetching
  - 110% gas headroom buffer
  - Clear error messages with current gas costs

**4. Network Reliability**
- **Risk:** RPC failures, bundler downtime
- **Mitigation:**
  - Multiple RPC endpoint fallbacks
  - Retry logic with exponential backoff
  - Clear error messaging for network issues

### Medium-Risk Areas

**1. Intent Parsing Ambiguity**
- **Risk:** User prompts may be ambiguous or incomplete
- **Mitigation:**
  - Robust clarify question system
  - Common pattern recognition in prompts
  - User guidance for optimal prompt formats

**2. Balance Calculation Accuracy**
- **Risk:** Race conditions between balance checks and execution
- **Mitigation:**
  - Just-in-time balance validation
  - Proper error handling for balance changes
  - Clear insufficient funds messaging

### Low-Risk Areas

**1. Explorer Link Generation**
- **Risk:** Incorrect block explorer URLs
- **Mitigation:** Static URL templates with comprehensive testing

**2. Idempotency Collisions**
- **Risk:** Hash collisions in idempotency keys
- **Mitigation:** Cryptographically secure hashing with sufficient entropy

---

## Acceptance Criteria Validation

### Core Functionality
- [ ] **User Authentication:** User logs in via Privy email+OTP successfully
- [ ] **Terminal Ready State:** Terminal switches to chat mode after authentication
- [ ] **Intent Parsing:** Prompt "transfer 0.001 ETH on base to 0x..." returns valid JSON
- [ ] **Clarify Handling:** Incomplete prompts trigger appropriate clarify questions
- [ ] **Address Validation:** Only checksummed addresses are accepted
- [ ] **Amount Validation:** Amount > 0 and within policy limits
- [ ] **Balance Validation:** Sufficient balance + gas headroom required
- [ ] **Smart Account Execution:** Successful transaction via Privy Smart Account
- [ ] **Auto-deployment:** Smart Account deploys automatically on first transaction
- [ ] **Transaction Monitoring:** Success shows explorer link within 8 seconds
- [ ] **Idempotency:** Duplicate prompts within 60s are prevented
- [ ] **Error Handling:** Clear, actionable error messages for all failure modes

### Security & Privacy
- [ ] **Non-custodial:** No server-side private key storage
- [ ] **Address Checksumming:** All addresses are properly checksummed
- [ ] **Zero Address Prevention:** Cannot send to 0x0000...0000
- [ ] **No Secret Logging:** No private keys, mnemonics, or secrets in logs
- [ ] **Amount Limits:** Per-transaction and daily limits enforced
- [ ] **Balance Protection:** Minimum balance maintained after transactions

### Performance & Reliability
- [ ] **Parse Performance:** AI intent parsing ≤ 2.5 seconds
- [ ] **End-to-End Performance:** Prompt → transaction hash ≤ 8 seconds (testnet)
- [ ] **TypeScript Strict:** No `any` types, full type safety
- [ ] **Error Recovery:** Graceful handling of network/bundler failures
- [ ] **Unit Test Coverage:** >90% coverage on critical paths
- [ ] **Integration Tests:** All Base Sepolia flows tested

### User Experience
- [ ] **Success Messaging:** `✅ Sent 0.002 ETH on Base — hash 0x...`
- [ ] **Clear Errors:** One-line actionable error messages
- [ ] **Loading States:** Appropriate spinners during processing
- [ ] **Explorer Integration:** Clickable transaction links
- [ ] **Confirmation Gates:** Optional confirmation for large transactions

---

## Rollback Plans

### Level 1: Feature Flag Rollback
**Trigger:** Critical bugs in production, high error rates
**Action:** Disable execution path via environment variable
**Fallback:** Terminal reverts to chat-only mode
**Recovery Time:** Immediate (next page refresh)

### Level 2: Component Rollback
**Trigger:** Smart Account integration issues
**Action:** Revert to previous terminal implementation
**Fallback:** Show "Smart Account transfers temporarily unavailable"
**Recovery Time:** < 30 minutes (deployment)

### Level 3: Full Rollback
**Trigger:** Security issues, data corruption
**Action:** Full feature removal via Git revert
**Fallback:** Previous stable version
**Recovery Time:** < 2 hours (full deployment cycle)

### Rollback Testing
- [ ] **Feature Flag Tests:** Verify graceful degradation
- [ ] **Component Isolation:** Ensure rollback doesn't break other features
- [ ] **Data Integrity:** No user data corruption during rollbacks
- [ ] **State Recovery:** User sessions remain stable during rollbacks

---

## Environment Configuration

### Development (.env.local)
```bash
# Privy Configuration
NEXT_PUBLIC_PRIVY_APP_ID="clm123..."
NEXT_PUBLIC_PRIVY_APP_SECRET="privy-secret-123..."

# Network Configuration
NEXT_PUBLIC_ALCHEMY_KEY="alch_base_key_123"
APP_CHAIN_DEFAULT=base
NODE_ENV=development

# AI Configuration
OPENROUTER_API_KEY="sk-or-v1-123..."

# Safety Configuration
CONFIRM_BEFORE_SEND=true
MAX_TX_AMOUNT_ETH=0.1
DAILY_SPEND_LIMIT_ETH=1.0
```

### Production (.env.production)
```bash
# Privy Configuration (Production App)
NEXT_PUBLIC_PRIVY_APP_ID="clm789..."
NEXT_PUBLIC_PRIVY_APP_SECRET="privy-prod-secret-789..."

# Network Configuration (Production RPCs)
NEXT_PUBLIC_ALCHEMY_KEY="alch_prod_key_789"
APP_CHAIN_DEFAULT=base
NODE_ENV=production

# AI Configuration (Production Keys)
OPENROUTER_API_KEY="sk-or-v1-prod-789..."

# Safety Configuration (Production Limits)
CONFIRM_BEFORE_SEND=false
MAX_TX_AMOUNT_ETH=1.0
DAILY_SPEND_LIMIT_ETH=5.0

# Monitoring
SENTRY_DSN="https://sentry.io/123..."
```

### Testnet (.env.staging)
```bash
# Base Sepolia Configuration
APP_CHAIN_DEFAULT=baseSepolia
NEXT_PUBLIC_ALCHEMY_KEY="alch_sepolia_key_456"
MAX_TX_AMOUNT_ETH=10.0
DAILY_SPEND_LIMIT_ETH=50.0
```

---

## Success Metrics & KPIs

### Performance Metrics
- **Intent Parse Time:** Target <2.5s, Alert >5s
- **End-to-End Latency:** Target <8s (testnet), <15s (mainnet)
- **Success Rate:** Target >95%, Alert <90%
- **Gas Estimation Accuracy:** Target ±5%, Alert ±20%

### User Experience Metrics
- **Clarify Rate:** Target <20% (most prompts understood first try)
- **Error Resolution Rate:** Target >80% (users successfully retry after errors)
- **Transaction Completion Rate:** Target >90% (successful execution after validation)

### Security Metrics
- **Failed Validation Rate:** Monitor for unusual patterns
- **Large Transaction Rate:** Monitor >$100 transactions
- **Duplicate Attempt Rate:** Monitor idempotency effectiveness

### Technical Metrics
- **Smart Account Deployment Success:** Target >98%
- **Bundler Success Rate:** Target >95%
- **RPC Availability:** Target >99%

---

## Dependencies & Prerequisites

### External Dependencies
- **Privy Dashboard Configuration:** Smart Accounts enabled
- **Base Network Access:** Alchemy API keys for Base + Base Sepolia
- **OpenRouter Account:** API access for Claude Sonnet
- **Domain Verification:** For production Privy app

### Internal Prerequisites
- **Authentication Flow:** Privy email+OTP login working
- **Terminal Components:** Basic terminal UI implemented
- **Wallet Connection:** useSmartWallet hook foundation

### Development Prerequisites
- **Node.js:** v18+ for Next.js 15.5.2
- **TypeScript:** v5+ for strict type checking
- **Testing Framework:** Vitest + Testing Library setup
- **Environment Variables:** All required keys configured

---

## Monitoring & Observability

### Application Monitoring
```typescript
// Transaction lifecycle tracking
export const TransactionMetrics = {
  INTENT_PARSE_START: 'intent.parse.start',
  INTENT_PARSE_SUCCESS: 'intent.parse.success',
  INTENT_PARSE_ERROR: 'intent.parse.error',

  VALIDATION_START: 'validation.start',
  VALIDATION_SUCCESS: 'validation.success',
  VALIDATION_ERROR: 'validation.error',

  EXECUTION_START: 'execution.start',
  EXECUTION_SUCCESS: 'execution.success',
  EXECUTION_ERROR: 'execution.error',

  TRANSACTION_CONFIRMED: 'transaction.confirmed',
  TRANSACTION_FAILED: 'transaction.failed'
};
```

### Error Tracking
```typescript
// Structured error logging
export function logError(error: {
  code: string;
  message: string;
  userId?: string;
  promptId?: string;
  chainId?: number;
  context?: Record<string, any>;
}) {
  // Log to Sentry/DataDog
  // No sensitive information
}
```

### Performance Monitoring
- **Web Vitals:** Core Web Vitals tracking
- **API Response Times:** Intent parsing latency
- **RPC Performance:** Blockchain interaction timing
- **Smart Account Metrics:** Deployment and execution success rates

---

## Post-Launch Optimization

### Phase 1 Enhancements (Week 2-3)
- **ENS Name Resolution:** Support for .eth addresses
- **Gas Price Optimization:** Dynamic gas pricing strategies
- **Batch Transactions:** Multiple transfers in single user operation
- **Transaction History:** Local storage of user transaction history

### Phase 2 Enhancements (Month 2)
- **ERC-20 Token Support:** Popular token transfers
- **Session Keys:** Automated signing for small transactions
- **Advanced Policies:** Time-based limits, contract allowlists
- **Mobile Optimization:** PWA capabilities

### Phase 3 Enhancements (Month 3-6)
- **Cross-Chain Bridges:** LI.FI integration
- **Token Swaps:** DEX aggregator integration
- **DeFi Integrations:** Lending, staking, yield farming
- **Advanced AI:** Multi-step transaction planning

---

This PRP provides a comprehensive roadmap for implementing native ETH transfers on Base using Privy Smart Accounts. The plan prioritizes security, user experience, and maintainability while providing clear milestones and success criteria for each development phase.

**Ready for execution via `/execute-prp PRPs/native-transfer-base.md`**