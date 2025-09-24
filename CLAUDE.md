# CLAUDE.md — Project Rules & Operability Guide (ExecFi, Privy Edition)

> **Purpose.** This file is the _contract_ between our codebase and Claude Code / Claude API. It encodes how Claude should parse, plan, write code, and enforce machine-parsable outputs for our **prompt→transaction DeFi app**, now built on **Privy (embedded EOA)** + **Privy Smart Accounts (ERC-4337)** + **LI.FI**.
>
> **Prime directive.** _Be deterministic._ Prefer strict schemas, typed contracts, and validation gates over clever heuristics.
> **Always** write detailed changelog to /CHANGELOGS.md.

---

## 0) Operating modes

- **Intent/Planning mode (AI via OpenRouter)**
  - Input: natural-language terminal prompt.
  - Output: **strict JSON Intent v1.2** _or_ a single **clarify** object.
  - Rules: JSON only, no prose, no code fences. Temperature=0.

- **Coding mode (Claude Code in IDE)**
  - Input: `INITIAL.md` → generate PRP → implement against repo.
  - Stack: TypeScript strict, Viem, React/Next.js, Privy EOA, Privy Smart Accounts.
  - Deliverables: code + tests + docs, aligned with acceptance criteria.

---

## 1) Context ingestion order

1. `INITIAL.md` (feature scope + acceptance criteria)
2. `AGENTS.md` (planner/normalizer/validator/executor)
3. `README` or `CONTEXT-CLAUDE.md` (project-level context rules)
4. This `CLAUDE.md` (guardrails)
5. `/examples/**` (copy patterns)
6. Source files under `/hooks`, `/lib`, `/app`, `/api`

> Precedence: **INITIAL.md > AGENTS.md > CLAUDE.md**

---

## 2) Canonical contracts

### 2.1 Intent JSON (v1.2)

- **Success**

```json
{
  "ok": true,
  "intent": {
    "action": "transfer|swap|bridge|bridge_swap",
    "chain": "base|…|chainId",
    "token": { "type": "native", "symbol": "ETH", "decimals": 18 },
    "amount": "0.002",
    "recipient": "0x… or ENS"
  }
}
```

- **Clarify**

```json
{ "ok": false, "clarify": "short question", "missing": ["field"] }
```

- Rules: no invented data; if ambiguous → clarify; if “max” → `"amount":"MAX"`.

### 2.2 Normalizer output

```ts
{
  chainId: number,
  token: { symbol: string, address?: `0x${string}`, decimals: number },
  amountWei: bigint,
  to?: `0x${string}`
}
```

### 2.3 Execution interfaces

- **Native transfer**: `privyClient.sendUserOperation({ to, value })`
- **LI.FI flow**: `getRoutes` → select → `executeRoute(privyClient, route)`

---

## 3) Guardrails & scope

- **Non-custodial**: No server-side keys. Privy holds EOAs, Privy derives SAs client-side.
- **Smart accounts only**: Canonical address = Privy Smart Account.
- **Supported chains** (MVP): Base (8453), Ethereum (1), Polygon (137), Arbitrum (42161), Optimism (10), Avalanche (43114). Default = Base.
- **Gas**: MVP = user-paid. Paymaster integration is out of scope.
- **Quotes**: Required only for swaps/bridges.
- **Safety**: enforce checksum, non-zero addresses, balance+gas headroom, per-tx/day caps, contract allowlists.

---

## 4) Strong correctness rules

- Determinism > heuristics. Always resolve chain via registry.
- Keep helpers small and composable.
- Privy auth + Smart Account SDK wiring are **client-only** (`"use client"`).
- Version pinning: use **Privy Smart Accounts SDK stable** APIs.
- Never attempt to export private keys.

---

## 5) Coding rules

- **Language/stack**: TS strict, Viem for chain utils, React/Next App Router.
- **Style**: ESLint + Prettier. Avoid `any` leaks.
- **Imports**: external → internal; avoid deep relative hell.
- **Config via env**:
  - `NEXT_PUBLIC_PRIVY_APP_ID`
  - `NEXT_PUBLIC_PRIVY_APP_SECRET`
  - `NEXT_PUBLIC_LIFI_API_KEY` (optional for swaps/bridges)

- **Errors**: throw typed errors; surface one-liners to users; log technical detail once.
- **DX**: JSDoc on all exports; code comments for non-obvious parts.

---

## 6) Privy Smart Account wiring (canonical pattern)

```ts
"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
const { client } = useSmartWallets();
```

**Gotchas:**

- First tx will deploy the smart account.
- User must hold gas tokens in MVP.
- Must always confirm chain matches app default.

---

## 7) Terminal UX contract

- **Success line**: `✅ Sent 0.002 ETH on Base — hash 0x…`
- **Error line**: concise + actionable (`Recipient must be a checksummed 0x address`).
- **Confirm gate**: ask `yes/no` for large/first-time recipients if `CONFIRM_BEFORE_SEND=true`.
- **Waiting**: show spinner; for LI.FI, stream status updates.

---

## 8) PRP workflow

- `/generate-prp INITIAL.md`: produce PRP with context, steps, validation gates, rollback plan.
- `/execute-prp PRPs/<feature>.md`: implement, run tests, iterate until green, summarize changes.

---

## 9) Testing & validation

- **Unit**: intent parsing, normalization, checksum, wei conversion.
- **Integration**: Base Sepolia, happy path native transfer.
- **E2E smoke**: terminal prompt → SA executes tx → explorer link shown.
- **Idempotency**: same prompt within 60s must not double-send.

Preferred test stack: Vitest + Testing Library.

---

## 10) Failure taxonomy

- `OFF_POLICY_JSON` – AI emitted invalid JSON → retry once.
- `MISSING_FIELDS` – emit clarify JSON.
- `CHAIN_UNSUPPORTED` – return list of supported chains.
- `INSUFFICIENT_FUNDS` – tell user to top up.
- `BUNDLER_REJECTED` / `SIMULATION_FAILED` – short message + log detail.

---

## 11) Security & privacy

- No secret logging.
- No server-side custody of keys.
- Maintain allowlists for contracts/tokens.
- Session keys (spend caps, TTL) can be added later.

---

## 12) Performance budgets

- Intent parse ≤ 2.5s (Claude Sonnet), terminal turnaround ≤ 8s to tx hash (Sepolia).
- Don’t bloat bundles — avoid importing heavy SDKs server-side.

---

## 13) Quick checklists

**Before emitting JSON**

- JSON only
- Clarify if ambiguous
- No invented fields

**Before merging code**

- TS strict, no `any` leaks
- Env-driven config, no hardcoded RPCs
- Unit & integration tests pass

**Before sending tx**

- Recipient checksummed
- AmountWei > 0, ≤ balance-gas
- Correct chainId
- SA deployed if needed

---

**TL;DR**: Claude, be **deterministic**.

- In API mode: emit **Intent JSON** only.
- In coding mode: follow `/examples`, wire **Privy Smart Accounts**, pass tests, protect users.

---
