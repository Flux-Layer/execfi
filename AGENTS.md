# AGENTS.md — Prompt→Transaction Agent System (Kentank)

> **Mission.** Turn natural language into **safe, verifiable on‑chain actions** using Privy (embedded EOA) → ZeroDev/Kernel (EP‑0.7, Kernel v3.1) → LI.FI (routing). This document specifies the **agent roster**, **state machine**, **schemas**, **policies**, and **execution wiring**. It is the authoritative reference for the runtime orchestrator.

> **Prime directives**
>
> 1. Non‑custodial by construction. 2) Smart‑accounts‑only. 3) JSON contracts over prose. 4) Safety > convenience.

---

## 0) Topology (who does what)

```
User (Terminal)
  → LLM Intent Parser (JSON only)
    → Normalizer (chains/tokens/amounts/addresses)
      → Policy/Validator (caps, allowlists, balances, invariants)
        → Planner (choose op: transfer | swap | bridge | bridge_swap)
          → Simulator (dry‑run / estimation / quote staleness)
            → Executor (ZeroDev Kernel client / LI.FI)
              → Monitor (receipts, LI.FI status)
                → Notifier (terminal lines)
                  → Journal (telemetry, idempotency store)
```

Data never stored: private keys, mnemonics, session secrets.

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
                           └──────┘                              │               retry/backoff        re‑quote               ▼                ▼
                                                              FAIL_POLICY/INPUT  ───────────────────────────▶        ERROR ◀────────────── DONE
```

**Transitions**

- `INTENT → CLARIFY` when required fields are missing/ambiguous.
- `VALIDATE → ERROR` on policy/balance violations.
- `SIMULATE → PLAN` if quote expired or parameters change.
- `EXECUTE → MONITOR` after UserOp hash / route execution starts.

---

## 2) Canonical schemas

### 2.1 Intent v1.2 (Claude → app)

```ts
export type IntentSuccess = {
  ok: true;
  intent:
    | {
        action: "transfer";
        chain: string | number; // "base" | 8453
        token: { type: "native"; symbol: "ETH"; decimals: 18 };
        amount: string; // decimal or "MAX"
        recipient: string; // 0x.. or ENS
      }
    | {
        action: "swap" | "bridge" | "bridge_swap";
        fromChain: string | number;
        toChain?: string | number; // required for bridge/bridge_swap
        fromToken: string; // symbol or address
        toToken: string; // symbol or address
        amount: string; // decimal or "MAX"
      };
};

export type IntentClarify = {
  ok: false;
  clarify: string; // one short question
  missing: string[]; // fields needed
};
```

### 2.2 NormalizedIntent (app internal)

```ts
export type NormalizedIntent =
  | {
      kind: "native-transfer";
      chainId: number;
      amountWei: bigint; // resolves MAX -> balance - gasHeadroom
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
      toChainId: number; // = fromChainId for same-chain swap
      fromToken: { address: `0x${string}`; symbol: string; decimals: number };
      toToken: { address: `0x${string}`; symbol: string; decimals: number };
      amountWei: bigint;
      slippageBps: number; // default 50 bps
      deadlineSec: number; // default now + 15m
    };
```

### 2.3 Execution envelope

```ts
export type ExecEnvelope = {
  userId: string;
  promptId: string; // idempotency key
  intent: IntentSuccess["intent"];
  norm: NormalizedIntent;
  policySnapshot: PolicySnapshot;
};
```

---

## 3) Normalizer

**Responsibilities**

- Resolve chain identifiers (name→chainId)
- Resolve tokens (symbol/address→address/decimals) using a registry per chain
- ENS→0x (if ENS provided); checksum addresses
- Parse `amount` → `amountWei`; if `MAX`, compute from balances minus gas headroom

**Inputs**: `IntentSuccess.intent`

**Outputs**: `NormalizedIntent`

**Failure**: `UNSUPPORTED_CHAIN`, `TOKEN_UNKNOWN`, `ADDRESS_INVALID`, `BALANCE_QUERY_FAILED`

---

## 4) Policy/Validator

**Hard checks**

- Chain allowlist
- Address: EIP‑55 checksum, not zero, not disallowed
- Amount: `> 0` and `≤ balance - gasHeadroom`
- Caps: per‑tx and per‑day USD equivalent (if price feed present)
- Token/contract allowlists; method allowlist (for execution)

**Outcomes**: pass → Planner; fail → ERROR with actionable message

---

## 5) Planner

**Mapping**

- `transfer` + native → `native-transfer`
- `transfer` + ERC‑20 (future) → `erc20-transfer`
- `swap`/`bridge`/`bridge_swap` → LI.FI route plan

**Route policy (LI.FI)**

- Prefer reputable bridges/DEXs
- Min total fee; cap slippage
- Enforce deadline; fail if route ETA or fees exceed thresholds

**Outputs**

- For native/erc20 transfer: a single tx spec
- For LI.FI: a selected `route` (with metadata for UX summary)

---

## 6) Simulator

**Native/ERC‑20 transfers**

- Estimate gas; verify balance covers `value + gas`

**LI.FI**

- Ensure quote freshness (within validity window)
- Re‑quote if expired/stale or if user changed parameters

**Failure**: `SIMULATION_FAILED`, `QUOTE_EXPIRED`

---

## 7) Executor

**Kernel client from Privy**

```ts
async function getKernelClient(privyWallet: any) {
  /* pattern in CLAUDE.md */
}
```

**Native transfer**

```ts
await kernelClient.sendTransaction({ to, value: amountWei });
```

**ERC‑20 transfer (future)**

- If `spender` pull: `approve` → protocol executes `transferFrom`
- If direct: call token `transfer(to, amountWei)` via `sendTransaction({ to: token, data })`

**LI.FI**

```ts
const routes = await lifi.getRoutes(params);
const best = pickBestRoute(routes);
await lifi.executeRoute(kernelClient as any, best);
```

**Result**: `txHash` (native/ERC‑20) or LI.FI tracking id + per‑step tx hashes

---

## 8) Monitor & notifier

- Poll for receipt (native): `waitForUserOperationReceipt` or standard receipt
- Poll LI.FI status (bridge/swap)
- Stream updates to terminal (single‑line spinner + final line)
- On success: `✅ Sent X on Chain — hash 0x…`
- On failure: map to error taxonomy (below)

---

## 9) Error taxonomy (user‑facing)

- `OFF_POLICY_JSON` – AI did not emit JSON
- `MISSING_FIELDS` – ask clarify question
- `CHAIN_UNSUPPORTED` – list allowed chains
- `ADDRESS_INVALID` – show checksum hint
- `TOKEN_UNKNOWN` – ask for symbol/address
- `INSUFFICIENT_FUNDS` – show required vs available + gas hint
- `QUOTE_EXPIRED` – re‑quoting…
- `SIMULATION_FAILED` – compact reason; suggest smaller amount
- `BUNDLER_REJECTED` – display short reason; log detailed cause

Always return **one‑line actionable** messages to the terminal.

---

## 10) Journaling, idempotency, and concurrency

- **Idempotency key**: `keccak256(userId || norm.kind || chainId || to || amountWei || tsBucket)`
- Store last `promptId → status` for dedupe within TTL (e.g., 60s)
- Single‑flight per user per prompt to avoid double sends
- Persist: `{userId, intentJson, norm, planSummary, txHash?, status, error?}`

---

## 11) Config & constants

```
SUPPORTED_CHAINS = { 8453: "base", 1: "mainnet", 137: "polygon", 42161: "arbitrum", 10: "optimism", 43114: "avalanche" }
DEFAULT_SLIPPAGE_BPS = 50
DEFAULT_DEADLINE_MIN = 15
DAILY_SPEND_LIMIT_USD = 100
GAS_HEADROOM_MULT = 1.1
```

Token registry per chain (symbol→address, decimals). Keep in `lib/registry.ts`.

---

## 12) Security posture

- No secrets in logs; redact anything resembling seed/private key
- Allowlists for contracts/bridges when executing via LI.FI
- Optional **confirm gate** for large new recipients ("Type YES to confirm")
- Consider **session keys** later (Kernel policy module): TTL, spend cap, contract allowlist, easy revoke

---

## 13) Testing plan

**Unit**

- JSON sanitizer, intent schema validation
- Normalizer: chain/token resolution, amount→wei, ENS→0x
- Validator: caps, balances (mock viem `getBalance`)

**Integration (Base Sepolia)**

- Native transfer happy path; insuff. funds path
- Re‑quote path for LI.FI (simulate expiry)

**E2E**

- Terminal prompt → execution → explorer link line displayed

---

## 14) Reference pseudo‑code (end‑to‑end)

```ts
export async function orchestrate(prompt: string, ctx: Ctx) {
  const intentRes = await parseIntent(prompt); // JSON only
  if (!intentRes.ok) return notifyClarify(intentRes);

  const norm = await normalize(intentRes.intent, ctx);
  await validate(norm, ctx);

  const plan = await planFrom(norm, ctx); // tx spec or LI.FI route
  await simulate(plan, ctx);

  const client = await getKernelClient(ctx.privyWallet);
  const receiptOrId = await execute(plan, client, ctx);

  return monitorAndNotify(receiptOrId, plan, ctx);
}
```

---

## 15) UX copy contract (terminal)

- Parsing OK → print normalized summary before execution
- Success → `✅ Sent 0.002 ETH on Base — hash 0x…`
- Failure → one‑line reason + next action (retry, top‑up, clarify)

---

## 16) Extensibility roadmap

- **ERC‑20 transfers** with `approve`/`transferFrom` patterns
- **Permit (EIP‑2612)** for gasless approvals where supported
- **Session keys** for agent‑driven micro‑ops (whitelists + TTL)
- **Guardian/recovery** module for Kernel (opt‑in)
- **Advanced intents**: DCA, limit orders (offchain monitoring, onchain exec)

---

## 17) Implementation anchors (file map)

```
/lib/ai/intent.ts        parseIntent(), parseAiJson(), zod schemas
/lib/normalize.ts        chain/token/amount/address resolution
/lib/validate.ts         policy checks, balances, caps
/lib/plan.ts             native vs LI.FI route selection
/lib/simulate.ts         gas/quote checks
/lib/execute.ts          ZeroDev client + LI.FI execute
/lib/monitor.ts          receipts + LI.FI status polling
/lib/registry.ts         chains/tokens
/hooks/useZeroDevSA.ts   Kernel client wiring
```

**This doc is living** — when flows or policies change, update schemas and state machine first, then code. Keep humans safe, then make it fast.
