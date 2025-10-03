# Unified "swap" Keyword Implementation Plan

## 🎯 Goal
Use single "swap" keyword for all operations with pattern-based detection:
- Same-chain swap
- Cross-chain bridge  
- Cross-chain bridge-swap

## 📋 Pattern Definitions

### Pattern 1: Same-Chain Swap
**Syntax**: `swap <amount> <tokenA> to <tokenB> on <chain>`

**Examples**:
```
swap 0.00001 eth to usdc on lisk
swap 100 usdc to dai on base
```

**Detection**: 
- Has "to" with second token
- Only ONE chain specified (or no chain = current chain)

**Intent**:
```typescript
{
  action: "swap",
  fromChain: "lisk",
  toChain: "lisk",      // Same as fromChain
  fromToken: "eth",
  toToken: "usdc",
  amount: "0.00001"
}
```

---

### Pattern 2: Bridge (Cross-Chain, Same Token)
**Syntax**: `swap <amount> <token> on <fromChain> to <toChain>`

**Examples**:
```
swap 0.00001 eth on lisk to base
swap 100 usdc on base to arbitrum
```

**Detection**:
- NO "to <token>" pattern
- TWO chains specified (fromChain and toChain)
- Token appears once

**Intent**:
```typescript
{
  action: "bridge",
  fromChain: "lisk",
  toChain: "base",
  token: "eth",
  amount: "0.00001"
}
```

---

### Pattern 3: Bridge-Swap (Cross-Chain, Different Tokens)
**Syntax**: `swap <amount> <tokenA> on <fromChain> to <tokenB> on <toChain>`

**Examples**:
```
swap 0.00001 eth on lisk to usdc on base
swap 100 usdc on base to dai on arbitrum
```

**Detection**:
- Has "to <token>" pattern
- TWO chains specified
- Two different tokens

**Intent**:
```typescript
{
  action: "bridge_swap",
  fromChain: "lisk",
  toChain: "base",
  fromToken: "eth",
  toToken: "usdc",
  amount: "0.00001"
}
```

---

## 🔧 Implementation Steps

### Step 1: Update Intent Parsing Regex
**File**: `src/cli/effects/intent.ts`

Current swap pattern:
```typescript
const swapMatch = ctx.raw.match(/swap\s+[\d.]+\s+(\w+)\s+to\s+(\w+)(?:\s+on\s+(\w+))?/i);
```

New patterns needed:
```typescript
// Pattern 1: swap X eth to usdc on lisk
const sameChainSwapPattern = /swap\s+([\d.]+)\s+(\w+)\s+to\s+(\w+)(?:\s+on\s+(\w+))?/i;

// Pattern 2: swap X eth on lisk to base
const bridgePattern = /swap\s+([\d.]+)\s+(\w+)\s+on\s+(\w+)\s+to\s+(\w+)(?!\s+on)/i;

// Pattern 3: swap X eth on lisk to usdc on base
const bridgeSwapPattern = /swap\s+([\d.]+)\s+(\w+)\s+on\s+(\w+)\s+to\s+(\w+)\s+on\s+(\w+)/i;
```

**Detection Order** (most specific first):
1. Bridge-swap pattern (has both chains and both tokens)
2. Bridge pattern (has both chains, one token)
3. Same-chain swap pattern (one or no chains, two tokens)

---

### Step 2: Token Selection Chain Priority
**File**: `src/cli/effects/intent.ts`

When detecting ambiguous tokens, extract chain from the pattern:

```typescript
// For swap: "swap 0.00001 et to usdc on lisk"
// - fromToken "et" → query on "lisk"
// - toToken "usdc" → query on "lisk"

// For bridge: "swap 0.00001 et on lisk to base"
// - token "et" → query on "lisk" (fromChain)

// For bridge-swap: "swap 0.00001 et on lisk to usdc on base"
// - fromToken "et" → query on "lisk" (fromChain)
// - toToken "usdc" → query on "base" (toChain)
```

**Logic**:
```typescript
let tokenChain: string | number | undefined;

if (bridgeSwapMatch) {
  // First token on fromChain, second token on toChain
  tokenChain = isFirstToken ? bridgeSwapMatch[3] : bridgeSwapMatch[5];
} else if (bridgeMatch) {
  // Single token on fromChain
  tokenChain = bridgeMatch[3];
} else if (swapMatch) {
  // Both tokens on same chain
  tokenChain = swapMatch[4]; // The "on <chain>" part
}
```

---

### Step 3: Update AI Schema/Prompt
**File**: `src/lib/ai/schema.ts` (might not need changes)

The AI should still output:
- `action: "swap"` for same-chain
- `action: "bridge"` for cross-chain same token
- `action: "bridge_swap"` for cross-chain different tokens

But now the **pattern parsing** will detect these based on the unified "swap" keyword.

---

### Step 4: Update Intent Reconstruction
**File**: `src/cli/state/reducer.ts`

Token selection reconstruction needs to handle all three patterns:

```typescript
case "TOKEN.SELECT":
  const raw = state.flow.raw || "";
  
  // Detect pattern type
  const bridgeSwapMatch = raw.match(/swap\s+([\d.]+)\s+(\w+)\s+on\s+(\w+)\s+to\s+(\w+)\s+on\s+(\w+)/i);
  const bridgeMatch = raw.match(/swap\s+([\d.]+)\s+(\w+)\s+on\s+(\w+)\s+to\s+(\w+)(?!\s+on)/i);
  const swapMatch = raw.match(/swap\s+([\d.]+)\s+(\w+)\s+to\s+(\w+)(?:\s+on\s+(\w+))?/i);
  
  if (bridgeSwapMatch) {
    // Reconstruct bridge_swap intent
    reconstructedIntent = {
      action: "bridge_swap",
      fromChain: bridgeSwapMatch[3],
      toChain: bridgeSwapMatch[5],
      fromToken: selectedFromToken?.symbol || bridgeSwapMatch[2],
      toToken: selectedToToken?.symbol || bridgeSwapMatch[4],
      amount: bridgeSwapMatch[1],
      _selectedFromToken: selectedFromToken,
      _selectedToToken: selectedToToken,
    };
  } else if (bridgeMatch) {
    // Reconstruct bridge intent
    reconstructedIntent = {
      action: "bridge",
      fromChain: bridgeMatch[3],
      toChain: bridgeMatch[4],
      token: selectedToken?.symbol || bridgeMatch[2],
      amount: bridgeMatch[1],
      _selectedToken: selectedToken,
    };
  } else if (swapMatch) {
    // Reconstruct swap intent (existing logic)
    reconstructedIntent = {
      action: "swap",
      fromChain: swapMatch[4] || selectedToken.chainId,
      toChain: swapMatch[4] || selectedToken.chainId,
      fromToken: selectedFromToken?.symbol || swapMatch[2],
      toToken: selectedToToken?.symbol || swapMatch[3],
      amount: swapMatch[1],
      _selectedFromToken: selectedFromToken,
      _selectedToToken: selectedToToken,
    };
  }
```

---

## 🧪 Test Cases

### Test 1: Same-Chain Swap
```
Input: swap 0.00001 eth to usdc on lisk
Expected Action: swap
Expected Chains: lisk → lisk
Expected Tokens: eth → usdc
```

### Test 2: Bridge (Cross-Chain)
```
Input: swap 0.00001 eth on lisk to base
Expected Action: bridge
Expected Chains: lisk → base
Expected Token: eth (same on both chains)
```

### Test 3: Bridge-Swap
```
Input: swap 0.00001 eth on lisk to usdc on base
Expected Action: bridge_swap
Expected Chains: lisk → base
Expected Tokens: eth → usdc
```

### Test 4: Ambiguous Token with Chain Priority
```
Input: swap 0.00001 et to usdc on lisk
1. Detects ambiguous "et"
2. Queries tokens on LISK (specified chain)
3. Shows selection
4. User selects ETH
5. Continues as same-chain swap on lisk
```

### Test 5: Bridge with Ambiguous Token
```
Input: swap 0.00001 et on lisk to base
1. Detects ambiguous "et"
2. Queries tokens on LISK (fromChain)
3. Shows selection
4. User selects ETH
5. Continues as bridge lisk → base
```

---

## 📝 Files to Modify

1. **`src/cli/effects/intent.ts`**
   - Update pattern detection logic
   - Add chain priority for token selection
   - Handle all three patterns

2. **`src/cli/state/reducer.ts`**
   - Update TOKEN.SELECT handler
   - Add reconstruction for bridge and bridge_swap patterns

3. **`src/lib/ai/schema.ts`** (optional)
   - Update examples/documentation
   - AI can still output bridge/bridge_swap actions

---

## 🎯 Benefits

1. **Simpler UX** - One keyword "swap" for everything
2. **Intuitive** - Pattern matches natural language
3. **Chain-Aware** - Token selection on correct chain
4. **Consistent** - Same command structure across operations

---

## ⚠️ Edge Cases

1. **Ambiguous patterns**:
   ```
   swap 0.1 eth on base to polygon
   ```
   Is this bridge ETH or swap on Base with "to polygon" as recipient?
   → Solved: Check if "polygon" is a valid chain name

2. **Missing chain**:
   ```
   swap 0.1 eth to usdc
   ```
   → Use current chain for both fromChain and toChain

3. **One chain specified**:
   ```
   swap 0.1 eth to usdc on base
   ```
   → Same-chain swap on Base

---

_Next: Implement Step 1 (Pattern Detection)_
