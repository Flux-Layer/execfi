# Token Selection Bug: Chain Filtering Issue

## Problem Statement

**Current Issue**: When transfer transactions trigger token selection (due to ambiguous token symbols), the system queries and displays tokens from ALL chains instead of filtering by the chain specified in the prompt or the current selected chain.

**Expected Behavior**: Token selection should only show tokens from:
1. The chain explicitly mentioned in the prompt (e.g., "send 0.1 arb to address **on ethereum**")
2. The current selected chain if no chain is mentioned in the prompt

## Root Cause Analysis

### Investigation Summary
I've traced the bug to the intent parsing effect in `src/cli/effects/intent.ts`. Here's the complete flow:

### Current Flow
1. **User Input**: `"send 0.1 arb to 0x123..."`
2. **AI Parsing**: Creates `IntentSuccess` with `TransferIntent` containing `chain: "base"` (or current chain)
3. **Token Selection Trigger**: When token is ambiguous, `isIntentTokenSelection()` returns true
4. **🔥 BUG LOCATION**: In `intent.ts:172`, `resolveTokensMultiProvider(ambiguousSymbol)` is called **without the chain parameter**
5. **Multi-Provider Search**: Searches ALL chains because `chainIds: chainId ? [chainId] : undefined` resolves to `undefined`
6. **Result**: User sees tokens from all chains instead of filtered results

### Code Locations

#### Primary Bug Location
**File**: `src/cli/effects/intent.ts:172`
```typescript
const enhancedResult = await resolveTokensMultiProvider(ambiguousSymbol);
//                                                     ^^^^^^^^^^^^^^
//                                                     Missing chainId parameter!
```

#### Related Functions
- **Token Resolution**: `src/lib/normalize.ts:163-285` - `resolveTokensMultiProvider()` function
- **Chain Information Source**: Available in `core.chainId` context and parsed `intent.chain`

### Data Flow Analysis
```
User Input → AI Parsing → IntentSuccess{intent: {chain: X}} → Token Selection
                                                ↓
                               resolveTokensMultiProvider(symbol) ← Missing chainId!
                                                ↓
                          Search Request: {chainIds: undefined} ← Searches ALL chains
                                                ↓
                                    Returns tokens from ALL chains
```

## Proposed Solution

### Solution 1: Pass Chain Context to Token Resolution (Recommended)

**Approach**: Modify the intent parsing effect to extract and pass the chain information to the token resolver.

#### Implementation Steps

1. **Extract Chain Information** in `src/cli/effects/intent.ts:157-172`:
   ```typescript
   // Extract chain from intent or use current chain
   const intentChain = intentResult.intent?.chain;
   const targetChainId = intentChain
     ? (typeof intentChain === 'number' ? intentChain : resolveChain(intentChain).id)
     : core.chainId;

   const enhancedResult = await resolveTokensMultiProvider(ambiguousSymbol, targetChainId);
   ```

2. **Add Chain Resolution Import**:
   ```typescript
   import { resolveChain } from "@/lib/chains/registry";
   ```

#### Benefits
- ✅ Minimal code changes
- ✅ Respects both prompt-specified chain and current chain
- ✅ Maintains backward compatibility
- ✅ Uses existing chain resolution logic

#### Risk Assessment
- 🟡 Low risk: Only affects token selection path
- 🟡 Need to handle chain resolution errors gracefully

### Solution 2: Enhance Context Passing (Alternative)

**Approach**: Modify the flow context to include resolved chain information earlier in the pipeline.

#### Implementation Steps

1. **Update Flow Context** in `src/cli/state/types.ts`:
   ```typescript
   export type FlowContext = {
     // ... existing fields
     resolvedChainId?: number; // Add resolved chain context
   }
   ```

2. **Set Resolved Chain** during intent parsing
3. **Use Resolved Chain** in token selection

#### Benefits
- ✅ More structured approach
- ✅ Chain resolution happens once

#### Drawbacks
- 🔴 More invasive changes
- 🔴 Requires state machine modifications

### Solution 3: Fallback Strategy (Enhanced)

**Approach**: Implement a fallback strategy that first tries chain-specific search, then expands if no results.

#### Implementation
```typescript
// Try chain-specific search first
let enhancedResult = await resolveTokensMultiProvider(ambiguousSymbol, targetChainId);

// If no results and user didn't specify chain explicitly, try all chains
if (enhancedResult.tokens.length === 0 && !isChainExplicitlySpecified) {
  enhancedResult = await resolveTokensMultiProvider(ambiguousSymbol);
}
```

#### Benefits
- ✅ Best user experience
- ✅ Handles edge cases

#### Drawbacks
- 🔴 More complex logic
- 🔴 Potential performance impact

## Recommended Implementation Plan

### Phase 1: Quick Fix (Recommended Solution 1)

**Priority**: HIGH
**Effort**: LOW (1-2 hours)
**Risk**: LOW

#### Changes Required:

1. **Modify `src/cli/effects/intent.ts`** (lines 157-172):
   ```typescript
   if (isIntentTokenSelection(intentResult)) {
     console.log("🎯 Token selection needed, using enhanced resolver");

     // Extract the symbol from the original raw input
     const tokenMatch = ctx.raw.match(/(?:send|transfer)\s+[\d.]+\s+(\w+)/i);
     const ambiguousSymbol = tokenMatch ? tokenMatch[1] : 'UNKNOWN';

     console.log("🔍 Detected ambiguous token symbol:", ambiguousSymbol);

     try {
       const { resolveTokensMultiProvider } = await import("@/lib/normalize");
       const { resolveChain } = await import("@/lib/chains/registry");

       // 🔧 FIX: Extract and resolve chain information
       const intentChain = intentResult.intent?.chain;
       const targetChainId = intentChain
         ? (typeof intentChain === 'number' ? intentChain : resolveChain(intentChain).id)
         : core.chainId;

       console.log("🚀 Calling enhanced token resolver for symbol:", ambiguousSymbol, "on chain:", targetChainId);
       const enhancedResult = await resolveTokensMultiProvider(ambiguousSymbol, targetChainId);

       // ... rest of existing code
     } catch (error) {
       // ... existing error handling
     }
   }
   ```

#### Testing Strategy:
1. Test with chain-specific prompts: `"send 0.1 arb to address on ethereum"`
2. Test with current chain: `"send 0.1 arb to address"` (should use current chain)
3. Test with invalid chains: Should gracefully fallback
4. Test existing functionality: Ensure no regression

### Phase 2: Enhanced UX (Optional)

**Priority**: MEDIUM
**Effort**: MEDIUM (4-6 hours)

1. Add chain name to token selection UI
2. Implement fallback strategy for edge cases
3. Add better error messages for unsupported chains

### Phase 3: Long-term Improvements (Future)

1. Cache chain-specific token results
2. Implement chain switching from token selection
3. Add chain auto-detection from token addresses

## Success Criteria

### Functional Requirements
- ✅ Token selection shows only tokens from the specified/current chain
- ✅ Chain specified in prompt takes precedence over current chain
- ✅ Graceful fallback for invalid chains
- ✅ No regression in existing functionality

### Performance Requirements
- ✅ Token selection response time < 3 seconds
- ✅ No unnecessary API calls to other chains

### User Experience Requirements
- ✅ Clear indication of which chain tokens are from
- ✅ Intuitive behavior matching user expectations

## Implementation Notes

### Error Handling
- Handle invalid chain names gracefully
- Fallback to current chain if specified chain is invalid
- Provide clear error messages

### Backward Compatibility
- Ensure existing prompts continue to work
- Maintain API compatibility for token resolution functions

### Testing Considerations
- Test with all supported chains
- Test edge cases (invalid chains, network errors)
- Test performance with large token lists
- Test UI rendering with long chain names

## Timeline

- **Investigation**: ✅ Complete
- **Phase 1 Implementation**: 1-2 hours
- **Testing & Validation**: 1 hour
- **Documentation Update**: 30 minutes
- **Total Estimated Time**: 2-3 hours

## Risk Mitigation

1. **Deploy to staging first**: Test thoroughly before production
2. **Feature flag**: Consider adding ability to disable chain filtering
3. **Monitoring**: Add logging to track token selection patterns
4. **Rollback plan**: Keep current implementation as fallback

---

**Status**: Analysis Complete ✅
**Next Action**: Begin Phase 1 Implementation
**Reviewer**: @dev-chris
**Last Updated**: 2025-09-29