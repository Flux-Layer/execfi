# TOKEN_REFACTOR.md — Multi-Provider Token Querying System

> **Objective**: Refactor ExecFi's token querying mechanism from single-provider (LI.FI) to an extensible multi-provider architecture that can query LI.FI, Relay, and future providers simultaneously while maintaining backward compatibility.

---

## 0) Current State Analysis

### **Existing Token Query Points**
```
📍 Primary Query Points:
├── /src/app/api/lifi/tokens/search/route.ts (LI.FI only)
├── /src/app/api/relay/route.ts (Relay only, isolated)
├── /src/lib/tokens.ts (Local registry)
└── /src/lib/lifi-client.ts (Direct LI.FI SDK)

🔄 Integration Points:
├── /src/lib/normalize.ts (Token resolution logic)
├── /src/lib/api-client.ts (Frontend API calls)
└── Frontend components (Token selection UI)
```

### **Current Issues**
- ❌ **Provider Isolation**: Relay exists but not integrated
- ❌ **Single Provider Dependency**: Primarily LI.FI-dependent
- ❌ **Limited Extensibility**: Hard to add CoinGecko, Moralis, etc.
- ❌ **Inconsistent Responses**: Different formats per provider
- ❌ **No Fallback Strategy**: Single point of failure

### **Success Metrics**
- ✅ **Multi-Provider Queries**: Query 2+ providers simultaneously
- ✅ **Intelligent Merging**: Smart deduplication and enhancement
- ✅ **Backward Compatibility**: No breaking changes to existing API
- ✅ **Easy Provider Addition**: Add new providers in <50 lines
- ✅ **Performance**: <2s response time with fallback strategy

---

## 1) Architecture Overview

### **Target Multi-Provider Architecture**
```
┌─────────────────────────────────────────────────────────────┐
│                   Token Query Orchestrator                 │
├─────────────────────────────────────────────────────────────┤
│  Provider Registry │  Query Engine  │  Response Merger     │
├─────────────────────────────────────────────────────────────┤
│     LI.FI Provider │  Relay Provider │  Future Providers   │
│                    │                 │  (CoinGecko, etc.)  │
├─────────────────────────────────────────────────────────────┤
│              Unified Token Response Schema                  │
└─────────────────────────────────────────────────────────────┘
```

### **Key Design Principles**
1. **Provider Interface**: Standardized contract for all token providers
2. **Parallel Execution**: Query all providers simultaneously using `Promise.all()`
3. **Intelligent Merging**: Priority-based conflict resolution and data enhancement
4. **Graceful Degradation**: Continue if some providers fail
5. **Configuration-Driven**: Enable/disable providers via environment variables
6. **Extensibility**: Add new providers by implementing interface

---

## 2) Implementation Phases

### **Phase 1: Core Infrastructure (Week 1)**

#### **1.1: Provider Interface & Registry System**
**Files**: `/src/lib/token-providers/`
```typescript
// Provider interface
interface TokenProvider {
  name: string;
  priority: number;
  enabled: boolean;
  searchTokens(params: TokenSearchParams): Promise<UnifiedToken[]>;
  getTokenDetails?(address: string, chainId: number): Promise<UnifiedToken | null>;
  healthCheck?(): Promise<boolean>;
}

// Provider registry
class TokenProviderRegistry {
  private providers: Map<string, TokenProvider>;
  register(provider: TokenProvider): void;
  getActiveProviders(): TokenProvider[];
  searchAll(params: TokenSearchParams): Promise<MultiProviderResult>;
}
```

#### **1.2: Unified Token Schema**
**Files**: `/src/types/unified-token.ts`
```typescript
export interface UnifiedToken {
  // Core token data
  address: string;
  symbol: string;
  name: string;
  chainId: number;
  decimals: number;

  // Enhanced metadata
  logoURI?: string;
  verified: boolean;
  priceUSD?: string;

  // Provider context
  sources: ProviderName[];
  confidence: number; // 0-100 based on source reliability

  // Provider-specific metadata
  metadata: {
    lifi?: LifiTokenMetadata;
    relay?: RelayTokenMetadata;
    local?: LocalTokenMetadata;
  };
}
```

#### **1.3: Multi-Provider Query Engine**
**Files**: `/src/lib/token-query-engine.ts`
```typescript
export class TokenQueryEngine {
  async searchTokens(params: TokenSearchParams): Promise<MultiProviderResult> {
    // Parallel provider queries
    const providerPromises = this.registry.getActiveProviders().map(async provider => {
      try {
        const results = await provider.searchTokens(params);
        return { provider: provider.name, success: true, tokens: results };
      } catch (error) {
        return { provider: provider.name, success: false, error };
      }
    });

    const providerResults = await Promise.allSettled(providerPromises);
    return this.mergeResults(providerResults, params);
  }
}
```

### **Phase 2: Provider Implementations (Week 2)**

#### **2.1: LI.FI Provider Implementation**
**Files**: `/src/lib/token-providers/lifi-provider.ts`
```typescript
export class LifiTokenProvider implements TokenProvider {
  name = "lifi";
  priority = 100; // Highest priority for pricing data
  enabled = process.env.ENABLE_LIFI_PROVIDER !== 'false';

  async searchTokens(params: TokenSearchParams): Promise<UnifiedToken[]> {
    // Wrap existing LI.FI logic
    const lifiTokens = await lifiSearchTokens(params);
    return this.convertToUnified(lifiTokens);
  }

  private convertToUnified(lifiTokens: LifiToken[]): UnifiedToken[] {
    // Convert LI.FI format to UnifiedToken
  }
}
```

#### **2.2: Relay Provider Implementation**
**Files**: `/src/lib/token-providers/relay-provider.ts`
```typescript
export class RelayTokenProvider implements TokenProvider {
  name = "relay";
  priority = 80; // Lower priority than LI.FI
  enabled = process.env.ENABLE_RELAY_PROVIDER !== 'false';

  async searchTokens(params: TokenSearchParams): Promise<UnifiedToken[]> {
    // Use existing Relay API logic
    const relayTokens = await this.fetchFromRelay(params);
    return this.convertToUnified(relayTokens);
  }
}
```

#### **2.3: Local Registry Provider**
**Files**: `/src/lib/token-providers/local-provider.ts`
```typescript
export class LocalTokenProvider implements TokenProvider {
  name = "local";
  priority = 60; // Fallback provider
  enabled = true; // Always enabled

  async searchTokens(params: TokenSearchParams): Promise<UnifiedToken[]> {
    // Use existing local registry logic
    const localTokens = searchTokensBySymbol(params.symbol, params.chainId);
    return this.convertToUnified(localTokens);
  }
}
```

### **Phase 3: Response Merging & Intelligence (Week 3)**

#### **3.1: Intelligent Token Merging**
**Files**: `/src/lib/token-merger.ts`
```typescript
export class TokenMerger {
  mergeTokens(providerResults: ProviderResult[]): MergedTokenResult {
    // 1. Group by address + chainId
    const tokenGroups = this.groupTokensByIdentifier(providerResults);

    // 2. Merge each group intelligently
    const mergedTokens = tokenGroups.map(group => this.mergeTokenGroup(group));

    // 3. Apply ranking and filtering
    return this.rankAndFilter(mergedTokens);
  }

  private mergeTokenGroup(tokens: UnifiedToken[]): UnifiedToken {
    // Priority-based merging:
    // - LI.FI: pricing data, verification
    // - Relay: additional verification, metadata
    // - Local: fallback data
  }
}
```

#### **3.2: Smart Deduplication Algorithm**
```typescript
interface DeduplicationStrategy {
  // Exact match: same address + chainId
  exactMatch(tokens: UnifiedToken[]): UnifiedToken[];

  // Fuzzy match: similar symbols but different addresses
  fuzzyMatch(tokens: UnifiedToken[]): SimilarTokenGroup[];

  // Confidence scoring based on sources
  calculateConfidence(token: UnifiedToken): number;
}
```

#### **3.3: Provider Health Monitoring**
**Files**: `/src/lib/provider-health.ts`
```typescript
export class ProviderHealthMonitor {
  private healthCache = new Map<string, HealthStatus>();

  async checkProviderHealth(provider: TokenProvider): Promise<HealthStatus> {
    // Cache health checks for 5 minutes
    // Disable providers that consistently fail
  }
}
```

### **Phase 4: API Integration (Week 4)**

#### **4.1: Enhanced Token Search API**
**Files**: `/src/app/api/tokens/search/route.ts` (new unified endpoint)
```typescript
// Replaces /api/lifi/tokens/search
export async function GET(request: NextRequest) {
  const queryEngine = new TokenQueryEngine();

  const result = await queryEngine.searchTokens({
    symbol: params.symbol,
    chainIds: params.chains,
    limit: params.limit,
  });

  return NextResponse.json({
    success: true,
    tokens: result.tokens,
    metadata: {
      providers: result.providerSummary,
      totalSources: result.sources.length,
      confidence: result.averageConfidence,
    },
  });
}
```

#### **4.2: Backward Compatibility Layer**
**Files**: `/src/app/api/lifi/tokens/search/route.ts` (maintained)
```typescript
// Keep existing endpoint for backward compatibility
export async function GET(request: NextRequest) {
  // Proxy to new multi-provider endpoint
  const result = await TokenQueryEngine.search(params);

  // Return in LI.FI format for compatibility
  return formatAsLifiResponse(result);
}
```

#### **4.3: Provider-Specific Endpoints**
```
/api/tokens/search         # New multi-provider endpoint
/api/lifi/tokens/search   # Backward compatibility (proxies to multi-provider)
/api/relay/route          # Keep for specific Relay queries
/api/tokens/providers     # Provider health and status
```

### **Phase 5: Frontend Integration (Week 5)**

#### **5.1: Enhanced API Client**
**Files**: `/src/lib/api-client.ts` (enhanced)
```typescript
export class TokenApiClient {
  // New multi-provider methods
  static async searchTokensMultiProvider(params): Promise<MultiProviderTokenResponse> {
    return this.request('/api/tokens/search', params);
  }

  // Enhanced methods with provider selection
  static async searchTokensFromProvider(provider: string, params): Promise<TokenResponse> {
    return this.request(`/api/tokens/search?provider=${provider}`, params);
  }

  // Backward compatible methods (unchanged interface)
  static async searchTokens(params): Promise<TokenSearchResponse> {
    // Uses new multi-provider backend but returns compatible format
  }
}
```

#### **5.2: Enhanced Normalization Layer**
**Files**: `/src/lib/normalize.ts` (updated)
```typescript
async function resolveLifiToken(symbol: string, chainId?: number) {
  // Replace with multi-provider resolver
  const result = await TokenQueryEngine.search({ symbol, chainIds: [chainId] });

  // Enhanced disambiguation with provider context
  if (result.needsSelection) {
    return {
      needsSelection: true,
      tokens: result.tokens,
      providerInfo: result.providerSummary, // Show which providers found each token
    };
  }
}
```

#### **5.3: Enhanced Token Selection UI**
```typescript
// Enhanced selection with provider badges
interface TokenSelectionProps {
  tokens: UnifiedToken[];
  onSelect: (token: UnifiedToken) => void;
  showProviderInfo?: boolean; // Show LI.FI, Relay badges
  showConfidence?: boolean;   // Show confidence scores
}
```

---

## 3) File Structure

```
/src/
├── lib/
│   ├── token-providers/
│   │   ├── index.ts                    # Provider registry and exports
│   │   ├── base-provider.ts            # Abstract base class
│   │   ├── lifi-provider.ts            # LI.FI implementation
│   │   ├── relay-provider.ts           # Relay implementation
│   │   ├── local-provider.ts           # Local registry implementation
│   │   └── coingecko-provider.ts       # Future: CoinGecko implementation
│   ├── token-query-engine.ts           # Core query orchestrator
│   ├── token-merger.ts                 # Intelligent merging logic
│   ├── provider-health.ts              # Health monitoring
│   └── api-client.ts                   # Enhanced API client
├── types/
│   ├── unified-token.ts                # UnifiedToken schema
│   └── provider-types.ts               # Provider interfaces
├── app/api/
│   ├── tokens/
│   │   ├── search/route.ts             # New unified endpoint
│   │   └── providers/route.ts          # Provider health endpoint
│   ├── lifi/tokens/search/route.ts     # Backward compatibility
│   └── relay/route.ts                  # Keep existing Relay endpoint
└── cli/
    └── token-provider-config.ts        # CLI for provider management
```

---

## 4) Environment Configuration

```bash
# Provider Toggle Switches
ENABLE_LIFI_PROVIDER=true
ENABLE_RELAY_PROVIDER=true
ENABLE_LOCAL_PROVIDER=true
ENABLE_COINGECKO_PROVIDER=false

# Provider API Keys
LIFI_API_KEY=your_lifi_api_key_here
COINGECKO_API_KEY=your_coingecko_api_key_here

# Provider Priority (higher = higher priority for conflicts)
LIFI_PROVIDER_PRIORITY=100
RELAY_PROVIDER_PRIORITY=80
LOCAL_PROVIDER_PRIORITY=60
COINGECKO_PROVIDER_PRIORITY=70

# Performance Settings
TOKEN_SEARCH_TIMEOUT_MS=5000
PROVIDER_HEALTH_CHECK_INTERVAL_MS=300000
TOKEN_CACHE_TTL_SECONDS=300
```

---

## 5) Multi-Provider Response Schema

### **Unified Token Search Response**
```typescript
interface MultiProviderTokenResponse {
  success: boolean;
  tokens: UnifiedToken[];
  metadata: {
    totalResults: number;
    providersQueried: string[];
    providersSuccessful: string[];
    providersFailed: string[];
    averageConfidence: number;
    queryTime: number;
    cacheHit: boolean;
  };
  providerSummary: {
    [providerName: string]: {
      results: number;
      responseTime: number;
      status: 'success' | 'failed' | 'timeout';
      error?: string;
    };
  };
}
```

### **Enhanced Token Object**
```typescript
interface UnifiedToken {
  // Standard fields
  address: string;
  symbol: string;
  name: string;
  chainId: number;
  chainName: string;
  decimals: number;
  logoURI?: string;
  verified: boolean;

  // Enhanced fields
  priceUSD?: string;
  sources: ('lifi' | 'relay' | 'local' | 'coingecko')[];
  confidence: number; // 0-100
  lastUpdated: string;

  // Provider-specific metadata
  metadata: {
    lifi?: {
      coinKey?: string;
      priceUSD?: string;
      verified: boolean;
    };
    relay?: {
      vmType?: string;
      depositAddressOnly: boolean;
    };
    local?: {
      registrySource: string;
    };
    coingecko?: {
      marketCap?: number;
      rank?: number;
    };
  };
}
```

---

## 6) Migration Strategy

### **Phase-by-Phase Migration**

#### **Week 1: Infrastructure**
- ✅ No breaking changes
- ✅ Build provider interfaces and registry
- ✅ Create unified token schema
- ✅ Test with existing LI.FI provider

#### **Week 2: Provider Integration**
- ✅ Integrate existing Relay endpoint
- ✅ Wrap existing local registry
- ✅ Parallel testing alongside current system

#### **Week 3: Intelligence Layer**
- ✅ Add smart merging and deduplication
- ✅ Implement provider health monitoring
- ✅ Performance optimization

#### **Week 4: API Enhancement**
- ✅ Deploy new `/api/tokens/search` endpoint
- ✅ Maintain backward compatibility
- ✅ Feature flag for gradual rollout

#### **Week 5: Frontend & Production**
- ✅ Update frontend to use enhanced APIs
- ✅ Full production deployment
- ✅ Monitor and optimize

### **Rollback Strategy**
```typescript
// Feature flags for instant rollback
const USE_MULTI_PROVIDER = process.env.USE_MULTI_PROVIDER_TOKENS === 'true';

if (USE_MULTI_PROVIDER) {
  // New multi-provider logic
} else {
  // Current LI.FI-only logic
}
```

### **A/B Testing**
- **50% traffic** to new multi-provider system
- **50% traffic** to current LI.FI system
- **Compare**: Response times, accuracy, user satisfaction

---

## 7) Future Provider Extensibility

### **Adding New Providers**
```typescript
// Example: CoinGecko provider
export class CoinGeckoTokenProvider implements TokenProvider {
  name = "coingecko";
  priority = 70;
  enabled = process.env.ENABLE_COINGECKO_PROVIDER === 'true';

  async searchTokens(params: TokenSearchParams): Promise<UnifiedToken[]> {
    // CoinGecko API integration
  }

  async getTokenDetails(address: string, chainId: number): Promise<UnifiedToken | null> {
    // Detailed token info with market data
  }
}

// Registration
TokenProviderRegistry.register(new CoinGeckoTokenProvider());
```

### **Future Provider Candidates**
- **CoinGecko**: Market data, rankings, historical prices
- **Moralis**: Multi-chain NFT and token data
- **Alchemy**: Enhanced metadata and verification
- **DefiLlama**: DeFi protocol token data
- **1inch**: DEX aggregator token prices

---

## 8) Performance & Monitoring

### **Performance Targets**
- **Multi-Provider Query**: < 2 seconds (95th percentile)
- **Provider Timeout**: 5 seconds maximum
- **Cache Hit Rate**: > 80% for common tokens
- **Provider Availability**: > 99% uptime

### **Monitoring Metrics**
```typescript
interface ProviderMetrics {
  responseTime: number;
  successRate: number;
  errorRate: number;
  tokenCoverage: number;
  priceDataAvailability: number;
}
```

### **Caching Strategy**
- **Token Search Results**: 5 minutes TTL
- **Provider Health**: 5 minutes TTL
- **Token Details**: 1 hour TTL
- **CDN**: Geographic edge caching

---

## 9) Success Criteria & Testing

### **Functional Requirements**
- ✅ **Multi-Provider Queries**: Successfully query 2+ providers
- ✅ **Intelligent Merging**: Combine results without duplicates
- ✅ **Provider Fallback**: Continue if 1 provider fails
- ✅ **Backward Compatibility**: No breaking changes to existing APIs
- ✅ **Easy Extension**: Add new provider in < 50 lines

### **Performance Requirements**
- ✅ **Response Time**: < 2s for multi-provider queries
- ✅ **Provider Timeout**: Individual provider timeout < 5s
- ✅ **Availability**: > 99% uptime
- ✅ **Cache Efficiency**: > 80% cache hit rate

### **Testing Strategy**
```typescript
// Unit Tests
- Provider interface compliance
- Token merging algorithm
- Deduplication logic
- Error handling

// Integration Tests
- Multi-provider parallel queries
- Provider failure scenarios
- Caching behavior
- API backward compatibility

// E2E Tests
- Token search flow
- Selection disambiguation
- Performance benchmarks
- Provider health monitoring
```

---

## 10) Implementation Timeline

### **Week 1: Core Infrastructure**
- **Day 1-2**: Provider interfaces and registry
- **Day 3-4**: Unified token schema and query engine
- **Day 5**: Testing with existing LI.FI provider

### **Week 2: Provider Implementations**
- **Day 1-2**: LI.FI provider wrapper
- **Day 3**: Relay provider integration
- **Day 4**: Local registry provider
- **Day 5**: Provider testing and validation

### **Week 3: Intelligence & Merging**
- **Day 1-2**: Token merger and deduplication
- **Day 3**: Provider health monitoring
- **Day 4**: Performance optimization
- **Day 5**: Integration testing

### **Week 4: API Integration**
- **Day 1-2**: New unified API endpoints
- **Day 3**: Backward compatibility layer
- **Day 4**: API testing and validation
- **Day 5**: Feature flag deployment

### **Week 5: Frontend & Production**
- **Day 1-2**: Frontend API client updates
- **Day 3**: Enhanced normalization layer
- **Day 4**: Production deployment
- **Day 5**: Monitoring and optimization

---

## 11) Risk Mitigation

### **Technical Risks**
- **Provider Downtime**: Multiple fallback providers
- **Response Time Increase**: Parallel queries with timeouts
- **Data Inconsistency**: Intelligent merging with conflict resolution
- **Breaking Changes**: Backward compatibility layer

### **Business Risks**
- **User Experience Degradation**: A/B testing and gradual rollout
- **API Rate Limits**: Distributed load across providers
- **Cost Increase**: Monitor and optimize API usage

### **Rollback Plan**
- **Feature Flags**: Instant rollback to current system
- **Monitoring**: Real-time performance and error tracking
- **Circuit Breakers**: Automatic provider disabling

---

## 12) Post-Implementation Enhancements

### **Advanced Features**
- **Machine Learning**: Token relevance scoring
- **Price Aggregation**: Real-time price averaging
- **Historical Data**: Price charts and trends
- **Advanced Filtering**: Custom search parameters

### **Analytics & Insights**
- **Provider Performance**: Success rates and response times
- **Token Coverage**: Gaps in provider data
- **User Behavior**: Search patterns and preferences
- **Cost Optimization**: API usage and efficiency

---

**This comprehensive plan provides a step-by-step roadmap for migrating ExecFi from single-provider to extensible multi-provider token querying while maintaining reliability, performance, and backward compatibility.**