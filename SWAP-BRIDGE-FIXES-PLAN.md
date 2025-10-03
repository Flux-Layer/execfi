# Swap/Bridge/BridgeSwap Flow Fixes - Implementation Plan

**Date**: 2024-01-04  
**Status**: 🔄 PLANNING

---

## 🎯 Objectives

Apply the same fixes from transfer flow to swap/bridge/bridge_swap flows:

1. **Move Chain Switch to Normalize Step** (currently in execute)
2. **Prioritize Chain from Prompt** for token selection
3. **Multi-Token Selection** - Use fromChain/toChain for bridge operations
4. **Add Confirmation UI** for these flows
5. **Add Clickable Explorer Links** after execution

---

## 🐛 Current Issues

### Issue #1: Chain Switch Too Late
- **Current**: Chain switching happens in `execute.ts` (execute step)
- **Problem**: Validation/simulation run on wrong chain
- **Fix**: Move to `normalize.ts` (normalize step)
- **Files**: `src/cli/effects/normalize.ts`, `src/cli/effects/execute.ts`

### Issue #2: Token Selection Uses Current Chain
- **Current**: Token selection defaults to `core.chainId`
- **Problem**: Queries tokens on wrong chain
- **Fix**: Prioritize chain from prompt (fromChain/toChain)
- **File**: `src/cli/effects/intent.ts`

### Issue #3: Multi-Token Selection Not Chain-Aware
- **Current**: Bridge operations don't specify which chain for each token
- **Problem**: Both tokens queried on same chain
- **Fix**: First token on fromChain, second token on toChain
- **File**: `src/cli/effects/intent.ts`, `src/cli/state/reducer.ts`

### Issue #4: No Confirmation UI
- **Current**: Confirm step is empty
- **Problem**: No transaction summary shown
- **Fix**: Add confirmation handlers
- **File**: `src/cli/effects/confirm.ts`, `src/cli/state/flows.ts`

### Issue #5: Missing Explorer Links
- **Current**: No clickable links after execution
- **Problem**: User can't easily view transaction
- **Fix**: Add CHAT.ADD dispatch with explorer-link
- **File**: `src/cli/effects/execute.ts`

---

## 📋 Implementation Steps

### Step 1: Move Chain Switch to Normalize ⏸️

**File**: `src/cli/effects/normalize.ts`

Replace the warning code with actual chain switching:

```typescript
// BEFORE: Just shows warning
if (requiredChainId && requiredChainId !== core.chainId) {
  console.log(`⚠️ ${verification.warning}`);
  dispatch({ type: "CHAT.ADD", message: "will be switched..." });
}

// AFTER: Actually switch the chain
if (requiredChainId && requiredChainId !== core.chainId && !ctx.chainSwitched) {
  console.log(`🔄 Chain switch required: ${currentChain} → ${requiredChainName}`);
  
  // 1. Request UI chain switch
  const switchSuccess = await requestChainSwitch(requiredChainId);
  if (!switchSuccess) throw new Error("Chain switch failed");
  
  // 2. Switch wallet chain (EOA)
  if (core.accountMode === "EOA" && core.selectedWallet) {
    await switchWalletChain(core.selectedWallet, requiredChainId);
  }
  
  // 3. Wait for propagation
  await waitForChainPropagation();
  
  // 4. Mark as switched
  ctx.chainSwitched = true;
  
  console.log(`✅ Chain switched to ${requiredChainName}`);
}
```

**File**: `src/cli/effects/execute.ts`

Replace chain switching with validation:

```typescript
// BEFORE: Switches chain in execute
if (needsChainSwitch) {
  await requestChainSwitch(targetChainId);
  await switchWalletChain(...);
  // ... long switching code
}

// AFTER: Just validate
if (core.chainId !== targetChainId) {
  console.error(`Chain mismatch at execution: expected ${targetChainId}, got ${core.chainId}`);
  dispatch({ type: "EXEC.FAIL", error: { code: "CHAIN_MISMATCH", ... }});
  return;
}
console.log(`✅ Chain validation passed: ${targetChainId}`);
```

---

### Step 2: Enhanced Token Selection for Bridge ⏸️

**File**: `src/cli/effects/intent.ts`

Current bridge pattern only extracts one chain:
```typescript
const bridgeMatch = ctx.raw.match(/bridge\s+[\d.]+\s+(\w+)(?:\s+from\s+(\w+))?(?:\s+to\s+(\w+))?/i);
// Uses: const chain = fromChain || toChain;  ← Only one chain!
```

Need to handle multi-token selection:
```typescript
if (isIntentTokenSelection(intentResult)) {
  // Determine if this is first or second token selection
  const isFirstTokenSelection = !state.flow?.selectedTokens?.fromToken;
  
  if (ctx.raw.match(/bridge|bridge.*swap/i)) {
    // For bridge operations: fromChain for first token, toChain for second
    const bridgeMatch = ctx.raw.match(/bridge\s+[\d.]+\s+(\w+)(?:\s+from\s+(\w+))?(?:\s+to\s+(\w+))?/i);
    const fromChain = bridgeMatch[2];
    const toChain = bridgeMatch[3];
    
    if (isFirstTokenSelection && fromChain) {
      targetChainId = resolveChain(fromChain).id;
      console.log(`✅ First token selection: using fromChain ${fromChain} (${targetChainId})`);
    } else if (!isFirstTokenSelection && toChain) {
      targetChainId = resolveChain(toChain).id;
      console.log(`✅ Second token selection: using toChain ${toChain} (${targetChainId})`);
    }
  }
}
```

---

### Step 3: Token Reconstruction for Bridge ⏸️

**File**: `src/cli/state/reducer.ts`

Currently bridge reconstruction is not implemented:
```typescript
} else if (raw.match(/\bbridge\b/i)) {
  return {
    ...state,
    flow: {
      ...state.flow,
      step: "failure",
      error: {
        code: "INTENT_RECONSTRUCTION_FAILED",
        message: "Bridge token reconstruction not yet implemented",
      },
    },
  };
}
```

Need to implement:
```typescript
} else if (raw.match(/\bbridge\b/i)) {
  // Parse: "bridge X token from chain1 to chain2"
  const amountMatch = raw.match(/bridge\s+([\d.]+)/i);
  const fromChainMatch = raw.match(/from\s+(\w+)/i);
  const toChainMatch = raw.match(/to\s+(\w+)/i);
  
  if (!amountMatch || !fromChainMatch || !toChainMatch) {
    return { ...state, flow: { ...state.flow, step: "failure", error: {...} }};
  }
  
  reconstructedIntent = {
    action: "bridge" as const,
    fromChain: resolveChain(fromChainMatch[1]).id,
    toChain: resolveChain(toChainMatch[1]).id,
    token: selectedToken.symbol,
    amount: amountMatch[1],
    _selectedToken: selectedToken,
  };
}
```

---

### Step 4: Add Confirmation Handlers ⏸️

**File**: `src/cli/effects/confirm.ts`

Add handlers for swap/bridge:
```typescript
export const confirmSwapFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  // Similar to confirmTransferFx but for swaps
  const norm = ctx.norm as NormalizedSwap;
  
  const summary = `
📝 Transaction Summary
──────────────────────────────────────────────────
Type: Swap
Chain: ${chainName} (${norm.fromChainId})
From: ${norm.fromAmount} ${norm.fromToken.symbol}
To: ${norm.toAmount} ${norm.toToken.symbol}
──────────────────────────────────────────────────
`;
  
  dispatch({ type: "CHAT.ADD", message: { content: summary, ... }});
  // ... confirmation prompt
};

export const confirmBridgeFx: StepDef["onEnter"] = async (ctx, core, dispatch, signal) => {
  // Similar for bridge
};
```

**File**: `src/cli/state/flows.ts`

Update flow definitions:
```typescript
export const swapFlow: FlowDef = {
  // ...
  confirm: {
    onEnter: confirmSwapFx,  // ← Add handler
  },
  // ...
};
```

---

### Step 5: Add Explorer Links ⏸️

**File**: `src/cli/effects/execute.ts`

Already in execute.ts around line 200+, but ensure it works for all flows:
```typescript
// Add explorer link to chat
if (executionResult.explorerUrl && executionResult.txHash) {
  dispatch({
    type: "CHAT.ADD",
    message: {
      role: "assistant",
      content: {
        type: "explorer-link",
        url: executionResult.explorerUrl,
        text: `View transaction: ${executionResult.txHash}`,
        explorerName: chainName,
      },
      timestamp: Date.now(),
    },
  });
}
```

---

## 📊 Files to Modify

| File | Changes | Purpose |
|------|---------|---------|
| `src/cli/effects/normalize.ts` | +60 lines | Move chain switch from execute to normalize |
| `src/cli/effects/execute.ts` | +10, -60 lines | Replace chain switch with validation |
| `src/cli/effects/intent.ts` | +40 lines | Multi-token selection with fromChain/toChain |
| `src/cli/state/reducer.ts` | +80 lines | Token reconstruction for bridge/bridge_swap |
| `src/cli/effects/confirm.ts` | +150 lines | Add confirmSwapFx, confirmBridgeFx, confirmBridgeSwapFx |
| `src/cli/state/flows.ts` | +6, -6 lines | Update confirm handlers |
| **Total** | **~346 lines** | Complete fix for all flows |

---

## 🧪 Testing Strategy

### Test Cases:

1. **Swap Same-Chain**: `swap 0.01 eth to usdc on base`
   - ✅ Chain: Should query tokens on Base
   - ✅ Confirmation: Shows swap summary
   - ✅ Execution: On Base chain
   - ✅ Link: Shows BaseScan link

2. **Swap Cross-Chain** (from different chain): Currently on Arbitrum, command `swap 0.01 eth to usdc on base`
   - ✅ Chain: Should switch Arbitrum → Base in normalize
   - ✅ Validation: Runs on Base
   - ✅ Execution: On Base

3. **Bridge**: `bridge 100 usdc from base to arbitrum`
   - ✅ Token Selection 1: Queries USDC on Base (fromChain)
   - ✅ Token Selection 2: If needed, queries on Arbitrum (toChain)
   - ✅ Chain Switch: Base in normalize
   - ✅ Confirmation: Shows bridge summary
   - ✅ Execution: From Base

4. **Bridge-Swap**: `bridge 0.1 eth from base to arbitrum and swap to usdc`
   - ✅ Token Selection: ETH on Base, USDC on Arbitrum
   - ✅ Chain Switch: Base in normalize
   - ✅ Confirmation: Shows bridge-swap summary

---

## ⚠️ Important Notes

### fromChain vs toChain
- **fromChain**: Where the transaction starts (source chain)
- **toChain**: Where the transaction ends (destination chain)
- **Chain switch target**: Always fromChain (source of funds)
- **First token**: Always on fromChain
- **Second token**: Always on toChain (if bridge/bridge_swap)

### Multi-Token Selection State
Need to track which token we're selecting:
```typescript
// In FlowContext
selectedTokens?: {
  fromToken?: TokenInfo;
  toToken?: TokenInfo;
  isSelectingFromToken?: boolean;
}
```

---

## 🚀 Implementation Order

1. ✅ **Transfer flow** - Already complete
2. ⏸️ **Swap flow** - Next (simpler, single chain)
3. ⏸️ **Bridge flow** - After swap (multi-chain, single token)
4. ⏸️ **Bridge-Swap flow** - Last (multi-chain, multi-token)

---

## 📝 Next Action

**Start with normalize.ts** - Move chain switching logic for all flows.

This will ensure all flows (swap/bridge/bridge_swap) switch chains early, just like transfer does.

**Command to start**:
```
Read src/cli/effects/normalize.ts
Edit to add chain switching logic
Test build
```

---

**Status**: Ready to implement  
**Estimated Time**: 30-45 minutes  
**Risk Level**: Medium (affects multiple flows)  
**Testing Required**: E2E for each flow type
