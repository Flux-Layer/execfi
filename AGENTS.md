# AGENTS.md — Prompt→Transaction Agent System (Kentank, Biconomy)

> **Mission.** Turn natural language into **safe, verifiable on-chain actions** using Privy (embedded EOA) → Biconomy Smart Accounts (ERC-4337) → LI.FI (routing).  
> This document specifies the **agent roster**, **state machine**, **schemas**, **policies**, and **execution wiring**. It is the authoritative reference for the runtime orchestrator.

> **Prime directives**
>
> 1. Non-custodial by construction.
> 2. Smart-accounts-only.
> 3. JSON contracts over prose.
> 4. Safety > convenience.

---

## 0) Topology (who does what)

```
User (Terminal)
  → LLM Intent Parser (JSON only)
    → Normalizer (chains/tokens/amounts/addresses)
      → Policy/Validator (caps, allowlists, balances, invariants)
        → Planner (choose op: transfer | swap | bridge | bridge_swap)
          → Simulator (gas estimate / quote freshness)
            → Executor (Biconomy client / LI.FI)
              → Monitor (receipts, LI.FI status)
                → Notifier (terminal lines)
                  → Journal (telemetry, idempotency store)
```

**Never stored**: private keys, mnemonics, session secrets.

---

## 1) Orchestrator state machine

```
┌───────────┐   prompt   ┌─────────────┐   ok=true   ┌────────────┐   pass   ┌──────────┐   plan   ┌────────────┐  pass  ┌──────────┐  done  ┌──────────┐
│  START    │ ─────────▶ │  INTENT     │ ───────────▶│ NORMALIZE  │ ────────▶│ VALIDATE │ ───────▶│   PLAN     │ ───────▶│ SIMULATE │ ─────▶│ EXECUTE  │ ─────▶│ MONITOR  │
└───────────┘            │(Claude JSON)│             └────────────┘          └──────────┘          └────────────┘        └──────────┘       └──────────┘
                              │               ▲                 ▲                  ▲                    ▲                     │                │
                   ok=false   │               │                 │                  │                    │                     │                │
                           ┌──▼───┐           │                 │                  │                    │                fail │           success/fail
                           │CLARIFY│──────────┘                 │                  │                    │                     │                │
                           └──────┘                              │               retry/backoff        re-quote               ▼                ▼
                                                              FAIL_POLICY/INPUT  ───────────────────────────▶        ERROR ◀────────────── DONE
```

---

## 2) Canonical schemas

### 2.1 Intent v1.2 (Claude → app)

```ts
export type IntentSuccess = {
  ok: true;
  intent:
    | {
        action: "transfer";
        chain: string | number;
        token: { type: "native"; symbol: "ETH"; decimals: 18 };
        amount: string; // decimal or "MAX"
        recipient: string; // 0x.. or ENS
      }
    | {
        action: "swap" | "bridge" | "bridge_swap";
        fromChain: string | number;
        toChain?: string | number;
        fromToken: string;
        toToken: string;
        amount: string;
      };
};

export type IntentClarify = {
  ok: false;
  clarify: string;
  missing: string[];
};
```

### 2.2 NormalizedIntent (internal)

```ts
export type NormalizedIntent =
  | {
      kind: "native-transfer";
      chainId: number;
      amountWei: bigint;
      to: `0x${string}`;
    }
  | {
      kind: "erc20-transfer";
      chainId: number;
      token: { address: `0x${string}`; symbol: string; decimals: number };
      amountWei: bigint;
      to: `0x${string}`;
    }
  | {
      kind: "swap" | "bridge" | "bridge-swap";
      fromChainId: number;
      toChainId: number;
      fromToken: { address: `0x${string}`; symbol: string; decimals: number };
      toToken: { address: `0x${string}`; symbol: string; decimals: number };
      amountWei: bigint;
      slippageBps: number;
      deadlineSec: number;
    };
```

### 2.3 Execution envelope

```ts
export type ExecEnvelope = {
  userId: string;
  promptId: string;
  intent: IntentSuccess["intent"];
  norm: NormalizedIntent;
  policySnapshot: PolicySnapshot;
};
```

---

## 3) Normalizer

- Resolve chain (e.g. `"base" → 8453`).
- Resolve tokens (symbol → address/decimals via registry).
- ENS → 0x; checksum all addresses.
- Parse `amount` → wei; if `"MAX"`, compute `balance - gasHeadroom`.

Failures: `CHAIN_UNSUPPORTED`, `TOKEN_UNKNOWN`, `ADDRESS_INVALID`.

---

## 4) Policy/Validator

- Chain allowlist.
- EIP-55 checksum; not zero address.
- Amount > 0 and ≤ balance-gas.
- Caps: per-tx/day in USD.
- Token/contract allowlists.

Fail → error with actionable message.

---

## 5) Planner

- `transfer` + native → native transfer.
- `transfer` + ERC-20 → erc20 transfer (future).
- `swap` / `bridge` / `bridge_swap` → LI.FI route.

Route policy: pick reputable routes, enforce slippage cap, ETA/deadline checks.

---

## 6) Simulator

- **Transfers**: gas estimate, verify balance covers `value+gas`.
- **LI.FI**: quote freshness; re-quote if expired.

Failures: `SIMULATION_FAILED`, `QUOTE_EXPIRED`.

---

## 7) Executor (Biconomy client)

```ts
import { createSmartAccountClient } from "@biconomy/account";

async function getBiconomyClient(privyWallet: any) {
  const eip1193 = await privyWallet.getEthereumProvider();
  return await createSmartAccountClient({
    signer: eip1193,
    bundlerUrl: process.env.NEXT_PUBLIC_BUNDLER_RPC!,
    biconomyPaymasterApiKey: process.env.NEXT_PUBLIC_BICONOMY_API_KEY,
    chainId: 8453, // Base (default)
  });
}
```

**Native transfer**

```ts
await biconomyClient.sendTransaction({ to, value: amountWei });
```

**LI.FI**

```ts
const routes = await lifi.getRoutes(params);
const best = pickBestRoute(routes);
await lifi.executeRoute(biconomyClient, best);
```

Result: tx hash(es) or LI.FI tracking id.

---

## 8) Monitor & notifier

- Poll receipts for txs via Biconomy SDK.
- Poll LI.FI status for cross-chain ops.
- Stream status to terminal (spinner → success/error).
- Success: `✅ Sent X on Chain — hash 0x…`.
- Errors: map to taxonomy.

---

## 9) Error taxonomy

- `OFF_POLICY_JSON` – invalid AI output.
- `MISSING_FIELDS` – clarify question.
- `CHAIN_UNSUPPORTED` – list allowed chains.
- `ADDRESS_INVALID` – checksum hint.
- `TOKEN_UNKNOWN` – ask for symbol/address.
- `INSUFFICIENT_FUNDS` – show required vs available.
- `QUOTE_EXPIRED` – re-quoting.
- `SIMULATION_FAILED` – suggest smaller amount.
- `BUNDLER_REJECTED` – short reason; log detail.

Always one-liner to user.

---

## 10) Journaling & idempotency

- PromptId = hash of `(userId, kind, chainId, to, amountWei, tsBucket)`.
- Deduplicate within 60s window.
- Persist `{ userId, intentJson, norm, plan, txHash?, status, error? }`.

---

## 11) Config & constants

```
SUPPORTED_CHAINS = { 8453:"base", 1:"mainnet", 137:"polygon", 42161:"arbitrum", 10:"optimism", 43114:"avalanche" }
DEFAULT_SLIPPAGE_BPS = 50
DEFAULT_DEADLINE_MIN = 15
DAILY_SPEND_LIMIT_USD = 100
GAS_HEADROOM_MULT = 1.1
```

---

## 12) Security posture

- No secrets in logs.
- Allowlist contracts for LI.FI.
- Optional confirm gate for large/new recipients.
- Future: session keys with TTL + spend caps.

---

## 13) Testing plan

**Unit**: JSON parse, schema validation, normalization, validator.  
**Integration**: Base Sepolia transfer (happy + insufficient funds).  
**E2E**: Prompt → execution → explorer link shown.

---

## 14) Pseudo-code orchestration

```ts
export async function orchestrate(prompt: string, ctx: Ctx) {
  const intentRes = await parseIntent(prompt);
  if (!intentRes.ok) return notifyClarify(intentRes);

  const norm = await normalize(intentRes.intent, ctx);
  await validate(norm, ctx);

  const plan = await planFrom(norm, ctx);
  await simulate(plan, ctx);

  const client = await getBiconomyClient(ctx.privyWallet);
  const receipt = await execute(plan, client, ctx);

  return monitorAndNotify(receipt, plan, ctx);
}
```

---

## 15) UX copy contract

- Summary before execution.
- Success → one-line with tx hash.
- Failure → concise, actionable.

---

## 16) Extensibility roadmap

- ERC-20 transfers.
- Permit (EIP-2612) approvals.
- Session keys for micro-ops.
- Guardians/recovery.
- Advanced intents (DCA, limit orders).

---

## 17) File anchors

```
/lib/ai/intent.ts        parseIntent, schemas
/lib/normalize.ts        chain/token/amount resolution
/lib/validate.ts         policy checks
/lib/plan.ts             op mapping, LI.FI route
/lib/simulate.ts         gas/quote checks
/lib/execute.ts          Biconomy client + LI.FI
/lib/monitor.ts          receipts/status
/lib/registry.ts         chains/tokens
/hooks/useBiconomySA.ts  Biconomy client wiring
```

---
