# LIFI_POWERED_REFACTOR.md — Complete Migration Plan

> **Objective**: Migrate ExecFi from direct Privy execution to LI.FI-powered routing and execution for all transaction operations while maintaining signatureless UX.

---

## 0) Architecture Overview

### **Current Architecture**
```
HSM Terminal → Intent Parser → Orchestrator Pipeline → Direct Execution (6 Steps) → Monitoring
                                    ↓
1. Client Validation → 2. Transaction Preparation → 3. Privy Execution
   ↓                      ↓                           ↓
4. Hash Validation → 5. Response Generation → 6. Error Classification
```

### **Target Architecture**
```
HSM Terminal → Intent Parser → Orchestrator Pipeline → LI.FI Execution (Enhanced 6 Steps) → LI.FI Monitoring
                                    ↓
1. Client Validation → 2. LI.FI Preparation API → 3. Privy Execution (Unchanged)
   ↓                     ↓                         ↓
4. Hash Validation → 5. Response Generation → 6. Enhanced Error Classification
         (Unchanged)       (Enhanced)              (LI.FI + Existing)
```

### **Key Benefits**
- ✅ Unified execution layer for transfers, swaps, bridges
- ✅ LI.FI's superior routing and rate optimization
- ✅ Multi-chain token resolution via LI.FI database
- ✅ Maintain signatureless Privy UX
- ✅ Server-side API key management
- ✅ Rate limiting and caching capabilities

---

## 1) Implementation Phases

### **Phase 1: Foundation & Token Resolution**

#### Step 1.1: LI.FI HTTP Client Layer
- **File**: `/src/lib/lifi-client.ts`
- **Purpose**: Core HTTP client for LI.FI API interactions
- **Features**:
  - Direct fetch/axios calls to LI.FI endpoints
  - Rate limiting and error handling
  - Response validation with Zod schemas
  - Retry logic with exponential backoff

#### Step 1.2: Token Search API Endpoint
- **File**: `/src/app/api/lifi/tokens/search/route.ts`
- **Purpose**: Multi-chain token resolution for disambiguation
- **LI.FI Endpoint**: `GET https://li.quest/v1/tokens`
- **Features**:
  - Search tokens by symbol across all chains
  - Return verified tokens with chain information
  - Support chain filtering for scoped searches

#### Step 1.3: Token Disambiguation Flow
- **Files**:
  - Update `/src/lib/normalize.ts`
  - Update terminal components for token selection UI
- **Purpose**: Handle lowercase tickers with multi-chain selection
- **Features**:
  - Detect ambiguous token symbols
  - Display selection table with chain info
  - Store selected token context for execution

### **Phase 2: Route Planning & Quoting**

#### Step 2.1: Route Planning API
- **File**: `/src/app/api/lifi/routes/route.ts`
- **Purpose**: Get optimal routes for transfers/swaps/bridges
- **LI.FI Endpoint**: `GET https://li.quest/v1/advanced/routes`
- **Features**:
  - Support same-chain transfers (Base → Base)
  - Cross-chain routing capabilities
  - Slippage and deadline configuration
  - Route optimization and filtering

#### Step 2.2: Quote Validation API
- **File**: `/src/app/api/lifi/quote/route.ts`
- **Purpose**: Validate and refresh route quotes
- **Features**:
  - Quote freshness validation
  - Price impact analysis
  - Gas estimation integration
  - Expiration handling

### **Phase 3: Execution Layer Migration**

> **Current Execution Steps Analysis**: The existing execution layer follows a 6-step process that must be preserved during LI.FI migration.

#### **Current Execution Architecture (execute.ts)**

**Step 7.1: Client Validation**
- Validate `smartWalletClient` for Smart Account mode
- Validate `eoaSendTransaction` + `selectedWallet` for EOA mode
- Throw `ExecutionError` if required clients missing

**Step 7.2: Transaction Preparation**
- **Native Transfer**: Direct `{ to, value }` object
- **ERC-20 Transfer**: Encode function data with `encodeFunctionData()`
- Generate transaction data for blockchain execution

**Step 7.3: Transaction Execution (Mode-Specific)**
- **Smart Account**: `smartWalletClient.sendTransaction()` or `sendUserOperation()`
- **EOA**: `eoaSendTransaction()` with wallet address
- Return transaction hash from successful execution

**Step 7.4: Transaction Hash Validation**
- Verify `txHash` exists and is valid string format
- Throw error if no hash returned from execution

**Step 7.5: Success Response Generation**
- Format amount using `formatEther()` or `formatUnits()`
- Generate success message with `formatSuccessMessage()`
- Create explorer URL with `getTxUrl()`
- Return structured `ExecutionResult`

**Step 7.6: Error Handling & Classification**
- Map Privy/blockchain errors to user-friendly messages
- Handle: insufficient funds, user rejection, gas errors, nonce errors, bundler/network errors
- Maintain error taxonomy for consistent UX

#### **LI.FI Migration Plan for Each Step**

#### Step 3.1: Enhanced Client Validation
- **File**: `/src/lib/execute.ts` (updated)
- **Changes**: Keep existing client validation logic
- **Addition**: Validate LI.FI API connectivity and route availability
- **Backward Compatibility**: Feature flag to use current vs LI.FI execution

#### Step 3.2: LI.FI Transaction Preparation API
- **File**: `/src/app/api/lifi/prepare/route.ts`
- **Purpose**: Replace Step 7.2 with LI.FI route preparation
- **Process**:
  1. Receive normalized intent from frontend
  2. Get optimal LI.FI route for the transaction
  3. Convert LI.FI route to unsigned transaction data
  4. Return transaction data for Privy signing
- **Features**:
  - Support same-chain transfers (Base → Base via LI.FI)
  - Handle cross-chain routing for future expansion
  - Gas estimation integration with LI.FI quotes
  - Route optimization and validation

#### Step 3.3: Execution Coordination Enhancement
- **File**: `/src/lib/execute.ts` (Step 7.3 replacement)
- **Purpose**: Coordinate LI.FI preparation + Privy signing
- **New Flow**:
  1. Call `/api/lifi/prepare` to get unsigned transaction
  2. Keep existing Privy client validation (Step 7.1)
  3. Execute transaction using Privy (Smart Account or EOA)
  4. Preserve existing success/error handling (Steps 7.4-7.6)
- **Maintain**: All existing client interfaces and error handling
- **Enhance**: Add LI.FI-specific error mapping

#### Step 3.4: LI.FI Status Tracking Integration
- **File**: `/src/app/api/lifi/status/route.ts`
- **Purpose**: Enhance monitoring with LI.FI status API
- **LI.FI Endpoint**: `GET https://li.quest/v1/status`
- **Integration**:
  - Supplement existing `monitor.ts` with LI.FI status
  - Handle bridge transactions and multi-chain operations
  - Provide enhanced status updates for complex routes
- **Backward Compatibility**: Keep existing viem-based monitoring as fallback

#### **Execution Layer Compatibility Matrix**

| Step | Current | LI.FI Migration | Compatibility |
|------|---------|-----------------|---------------|
| 7.1 | Client Validation | ✅ Keep + Enhance | 100% Backward Compatible |
| 7.2 | Direct Preparation | 🔄 LI.FI API Preparation | API Replacement |
| 7.3 | Privy Execution | ✅ Keep Same Signing | 100% Backward Compatible |
| 7.4 | Hash Validation | ✅ Keep Unchanged | 100% Backward Compatible |
| 7.5 | Response Generation | ✅ Keep + Enhance | 100% Backward Compatible |
| 7.6 | Error Handling | ✅ Keep + LI.FI Errors | Extended Error Taxonomy |

### **Phase 4: Frontend Integration**

#### Step 4.1: HSM Flow Updates
- **Files**: HSM state management and orchestrator
- **Purpose**: Integrate new API calls into existing flow
- **Changes**:
  - Add token search step for ambiguous symbols
  - Replace direct execution with API coordination
  - Update error handling for LI.FI-specific errors

#### Step 4.2: Terminal UX Enhancements
- **Files**: Terminal components
- **Purpose**: Enhanced user experience with LI.FI features
- **Features**:
  - Token selection tables
  - Route information display
  - Cross-chain status updates
  - Better error messaging

#### Step 4.3: API Client Integration
- **File**: `/src/lib/api-client.ts`
- **Purpose**: Frontend client for internal API calls
- **Features**:
  - Type-safe API calls
  - Error handling and retry logic
  - Request/response validation

### **Phase 5: Testing & Validation**

#### Step 5.1: API Testing
- **Purpose**: Validate all API endpoints
- **Coverage**:
  - Token search functionality
  - Route planning accuracy
  - Quote validation
  - Transaction preparation

#### Step 5.2: Integration Testing
- **Purpose**: End-to-end flow validation
- **Test Cases**:
  - Same-chain ETH transfers via LI.FI
  - ERC-20 token transfers with disambiguation
  - Cross-chain operations (future)
  - Error scenarios and edge cases

#### Step 5.3: UX Testing
- **Purpose**: Validate signatureless experience
- **Validation**:
  - No additional popups or confirmations
  - Seamless token selection flow
  - Consistent success/error messaging
  - Performance benchmarks

---

## 2) File Structure

```
/src/
├── lib/
│   ├── lifi-client.ts              # Core LI.FI HTTP client
│   ├── api-client.ts               # Frontend API client
│   ├── execute.ts                  # Updated execution coordinator
│   └── normalize.ts                # Enhanced token resolution
├── app/api/lifi/
│   ├── tokens/search/route.ts      # Token search endpoint
│   ├── routes/route.ts             # Route planning endpoint
│   ├── quote/route.ts              # Quote validation endpoint
│   ├── prepare/route.ts            # Transaction preparation
│   └── status/route.ts             # Status tracking endpoint
└── types/
    └── lifi.ts                     # LI.FI type definitions
```

---

## 3) Environment Variables

```bash
# LI.FI Configuration
LIFI_API_KEY=your_lifi_api_key_here
LIFI_API_URL=https://li.quest/v1
LIFI_RATE_LIMIT_PER_MINUTE=60

# Existing Privy Configuration
NEXT_PUBLIC_PRIVY_APP_ID=existing_privy_id
NEXT_PUBLIC_PRIVY_APP_SECRET=existing_privy_secret
```

---

## 4) API Schemas

### Token Search Request/Response
```typescript
// Request
interface TokenSearchRequest {
  symbol: string;
  chains?: number[];
  limit?: number;
}

// Response
interface TokenSearchResponse {
  tokens: Array<{
    address: string;
    symbol: string;
    name: string;
    chainId: number;
    chainName: string;
    decimals: number;
    logoURI?: string;
    verified: boolean;
    priceUSD?: string;
  }>;
}
```

### Route Request/Response
```typescript
// Request
interface RouteRequest {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress: string;
  slippage?: number;
}

// Response
interface RouteResponse {
  routes: Array<{
    id: string;
    fromAmount: string;
    toAmount: string;
    gasCost: string;
    steps: RouteStep[];
    tags: string[];
  }>;
}
```

---

## 5) Migration Strategy

### **Step-by-Step Execution Layer Migration**

#### **Phase A: Preparation (Steps 7.1, 7.4, 7.5, 7.6 Analysis)**
- Analyze and document all current execution step implementations
- Identify integration points for LI.FI without breaking existing flows
- Create comprehensive test coverage for each execution step

#### **Phase B: API Layer Development (Step 7.2 Replacement)**
- Build LI.FI preparation API (`/api/lifi/prepare`)
- Create transaction preparation logic that outputs same format as current Step 7.2
- Maintain identical interface for Step 7.3 consumption

#### **Phase C: Execution Enhancement (Step 7.3 Enhancement)**
- Update `executeIntent()` to call LI.FI preparation API
- Keep all existing Privy signing logic unchanged
- Add feature flag: `ENABLE_LIFI_EXECUTION=true/false`

#### **Phase D: Error & Response Enhancement (Steps 7.5, 7.6 Extension)**
- Extend success message formatting for LI.FI route information
- Add LI.FI-specific error handling while preserving existing taxonomy
- Enhance monitoring integration

### **Backward Compatibility Strategy**

```typescript
// Feature flag implementation in execute.ts
const useLifiExecution = process.env.ENABLE_LIFI_EXECUTION === 'true';

if (useLifiExecution) {
  // Step 7.2: Call LI.FI preparation API
  const transactionData = await prepareLifiTransaction(norm);
} else {
  // Step 7.2: Use current direct preparation
  const transactionData = prepareDirectTransaction(norm);
}

// Steps 7.3-7.6 remain identical regardless of preparation method
```

### **Risk Mitigation**
- **Execution Step Isolation**: Only Step 7.2 changes, all other steps preserved
- **Identical Interfaces**: LI.FI preparation outputs same format as current preparation
- **Gradual Rollout**: Feature flag allows instant fallback to current system
- **Comprehensive Testing**: Test each step independently and in integration
- **Error Handling**: Extend existing error taxonomy without breaking changes

### **Performance Considerations**
- **API Response Caching**: Cache LI.FI routes for identical requests
- **Preparation Timeout**: Set reasonable timeouts for LI.FI API calls
- **Fallback Strategy**: Auto-fallback to direct execution if LI.FI API fails
- **Monitoring Integration**: Track performance metrics for both execution paths

---

## 6) Success Criteria

### **Functional Requirements**
- ✅ All current transaction types work via LI.FI
- ✅ Token disambiguation flow is intuitive
- ✅ Signatureless UX is preserved
- ✅ Cross-chain capabilities are enabled
- ✅ Error handling is comprehensive

### **Performance Requirements**
- ✅ Token search: < 2 seconds
- ✅ Route calculation: < 3 seconds
- ✅ Transaction preparation: < 1 second
- ✅ End-to-end flow: < 8 seconds (same as current)

### **Quality Requirements**
- ✅ 100% test coverage for new API endpoints
- ✅ TypeScript strict mode compliance
- ✅ No breaking changes to existing UX
- ✅ Comprehensive error taxonomy
- ✅ Security audit of API layer

---

## 7) Implementation Order

1. **Week 1**: Phase 1 (Foundation & Token Resolution)
2. **Week 2**: Phase 2 (Route Planning & Quoting)
3. **Week 3**: Phase 3 (Execution Layer Migration)
4. **Week 4**: Phase 4 (Frontend Integration)
5. **Week 5**: Phase 5 (Testing & Validation)

Each phase includes comprehensive testing before proceeding to the next phase.

---

## 8) Future Enhancements

### **Advanced Features**
- Multi-hop route optimization
- MEV protection integration
- Advanced slippage management
- Batch transaction support

### **UX Improvements**
- Route comparison and selection
- Real-time price updates
- Transaction history with LI.FI data
- Advanced filtering and preferences

### **Monitoring & Analytics**
- LI.FI usage analytics
- Route performance tracking
- Cost savings analysis
- User behavior insights

---

**This plan provides a comprehensive roadmap for migrating to LI.FI while maintaining the current high-quality user experience and expanding capabilities for future growth.**