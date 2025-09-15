# INITIAL.md — MVP Feature Spec: Prompt→Native Transfer on **Base** (Smart‑Account Only)

> This is the single source of truth for the **next shippable increment**. It is scoped to _native ETH transfers on Base_ executed from the terminal via our **Privy → ZeroDev/Kernel (EP‑0.7, Kernel v3.1)** stack. No paymaster in MVP (user pays gas). This file is designed for Claude Code’s `/generate-prp` → `/execute-prp` flow.

---

## 0) Summary

**Goal:** From the terminal, a user types a prompt like `transfer 0.002 ETH on base to 0x…` → app parses intent → validates → executes via the user’s **Kernel smart account** on **Base mainnet (8453)** → shows explorer link. Works reliably on **Base Sepolia** first, then **Base mainnet** behind an env flag.

**Out of scope (for this PR):** ERC‑20 token transfers, swaps, bridges, paymaster sponsorship, session keys.

---

## 1) Functional requirements

1. **Prompt ingestion**: After login (Privy email+OTP), terminal accepts free‑form prompts.
2. **Intent parse (GPT 4o mini via OpenRouter)**: LLM returns **JSON‑only** in the Intent v1.1/1.2 schema (see CLAUDE.md/AGENTS.md). If missing fields → model returns a **clarify** JSON.
3. **Sanitization & validation**:
   - Sanitize AI output (our `parseAiJson`), validate with Zod schema.
   - Normalize to `{ chainId, amountWei, to }` for native transfer.
   - Validate: supported chain (Base 8453), EIP‑55 checksummed recipient, amount > 0, balance ≥ value + gas headroom, daily/per‑tx caps (config‑driven; allow disable in `.env`).

4. **Execution (AA)**:
   - Build **Kernel client** from Privy EOA (`toOwner` → ECDSA validator → Kernel v3.1, EP‑0.7) client‑side only.
   - `kernelClient.sendTransaction({ to, value })` (no data).
   - First tx deploys SA if not deployed.

5. **UX**:
   - Show **normalized summary** before executing (optional confirm gate off by default; add flag to enable confirm).
   - On success: `✅ Sent 0.002 ETH on Base — hash 0x…` with clickable explorer link.
   - On failure: single‑line actionable error (see taxonomy).

6. **Idempotency**: Same prompt within 60s window must not double‑send (derive an idempotency key; store in memory for now).
7. **Observability**: Log `{ userId, saAddress, promptId, norm, txHash?, status, error? }` (no secrets). Optional Sentry hook.

---

## 2) Non‑functional requirements

- **Security**: Non‑custodial; no keys server‑side; no logging secrets; contract/chain allowlists.
- **Determinism**: Strict JSON contract; TypeScript strict; no silent fallbacks.
- **Performance budgets**: Parse ≤ 2.5s (Sonnet), terminal round‑trip to hash ≤ 8s (testnets).
- **Resilience**: Clear errors for OFF_POLICY JSON, insufficient funds, bundler rejections; retry AI once with stricter instruction if off‑policy.

---

## 3) Contracts (copy‑exact)

### 3.1 Intent (LLM → app)

Success (transfer):

```json
{
  "ok": true,
  "intent": {
    "action": "transfer",
    "chain": "base",
    "token": { "type": "native", "symbol": "ETH", "decimals": 18 },
    "amount": "0.002",
    "recipient": "0x…"
  }
}
```

Clarify:

```json
{ "ok": false, "clarify": "Which chain? (base/mainnet)", "missing": ["chain"] }
```

### 3.2 Normalized intent (app internal)

```ts
export type NormalizedNativeTransfer = {
  kind: "native-transfer";
  chainId: 8453; // Base only in MVP
  to: `0x${string}`; // checksummed
  amountWei: bigint; // parseEther(amount)
};
```

---

## 4) UX flow (terminal)

1. **Authenticated** state reached → terminal switches to chat mode.
2. User types prompt.
3. If `ok:false` clarify → render question inline and accept next line.
4. If `ok:true`:
   - Render normalized summary: `You’re sending 0.002 ETH on Base to 0x…`.
   - (Optional `CONFIRM_BEFORE_SEND=true`) ask `Type YES to confirm`.
   - Execute; show spinner; then success line with explorer URL or error line.

**Copy rules**: terse, friendly; single line for success/error; no stack traces.

---

## 5) Implementation plan (files & steps)

### A) AI layer

- `/lib/ai/parse.ts` — `parseAiJson(raw: string): any` (from AGENTS.md Appendix B).
- `/lib/ai/intent.ts` — `parseIntent(prompt: string): Promise<IntentSuccess|IntentClarify>` using OpenRouter; temperature 0; JSON‑only; one retry on OFF_POLICY.
- `/lib/ai/schema.ts` — Zod schema for Intent v1.1/1.2.

### B) Normalization & validation

- `/lib/normalize.ts` — `normalizeTransfer(intent, userAddress): NormalizedNativeTransfer` (resolve chain="base"→8453; parse amount; checksum `to`).
- `/lib/validation.ts` — balance check with Viem public client (Base), gas headroom (110%), per‑tx/day caps driven by env.

### C) AA wiring (client)

- `/hooks/useZeroDevSA.ts` — Build **Kernel v3.1** client from Privy EOA (pattern in CLAUDE.md §6). Export `{ client, saAddress }`.
- Ensure existing `usePrivyEOA` hardened readiness and single‑flight creation.

### D) Orchestrator glue

- `/lib/execute.ts` — `executeNativeTransfer(client, norm): Promise<string /* txHash */>`.
- `/lib/idempotency.ts` — in‑memory map `{promptId→timestamp}`; helper to guard double sends.

### E) Terminal integration

- Update `PromptTerminal` `handleSubmitLine`:
  - On free‑form prompt, call `parseIntent()`.
  - Branch: clarify vs exec.
  - On exec: use `useZeroDevSA()` to get client; call `executeNativeTransfer()`; append success/error line.

### F) Explorer helpers

- `/lib/explorer.ts` — `txUrl(chainId, hash): string` → Base/Blockscout/Etherscan.

---

## 6) Env & config

```
NEXT_PUBLIC_PRIVY_APP_ID=...
NEXT_PUBLIC_BUNDLER_RPC=...
# NEXT_PUBLIC_PAYMASTER_RPC=...          # unused in MVP
OPENROUTER_API_KEY=...
APP_CHAIN_DEFAULT=base
CONFIRM_BEFORE_SEND=false
MAX_SLIPPAGE_BPS=50                      # reserved for later (LI.FI)
DAILY_SPEND_LIMIT_USD=100                # optional; can disable
```

---

## 7) Acceptance criteria (must‑haves)

- [ ] User logs in (email/OTP). After auth, terminal is ready.
- [ ] Prompt `transfer 0.001 ETH on base to 0x…` executes via **Kernel SA** on **Base Sepolia** and prints explorer link.
- [ ] Handles `clarify` responses correctly.
- [ ] Validates checksum, amount>0, sufficient balance/gas.
- [ ] Idempotency: re‑submit same prompt within 60s does **not** double send.
- [ ] No server‑side key storage; no secret logs.
- [ ] Types are strict; lint/tests pass.

**Nice‑to‑haves (stretch):**

- [ ] Optional confirmation gate (`CONFIRM_BEFORE_SEND=true`).
- [ ] Graceful error mapping for common bundler failures.

---

## 8) Tests

**Unit**

- `parseAiJson` happy/off‑policy.
- Intent schema validation: success vs clarify.
- Normalization: `base`→8453; `parseEther("0.002")`; checksum enforcement.
- Validation: insufficient funds path; gas headroom check.

**Integration (Base Sepolia)**

- Build client; send small native transfer (value tiny); assert tx hash present.

**E2E (manual or Playwright smoke)**

- Terminal prompt → success line with clickable explorer link.

---

## 9) Error taxonomy (user‑facing one‑liners)

- `OFF_POLICY_JSON`: “I couldn’t parse that as a transaction. Try: `transfer 0.02 ETH on base to 0x…`”
- `MISSING_FIELDS`: echo clarify question from model.
- `CHAIN_UNSUPPORTED`: “Only Base supported for now.”
- `ADDRESS_INVALID`: “Recipient must be a checksummed 0x address.”
- `INSUFFICIENT_FUNDS`: “Balance too low for amount + gas.”
- `BUNDLER_REJECTED` / `SIMULATION_FAILED`: “Transaction failed to validate; try a smaller amount.”

---

## 10) Risks & mitigations

- **LLM off‑policy output** → strict JSON contract + sanitizer + retry.
- **Bundler variance** → use ZeroDev project RPC; show actionable error.
- **Gas volatility** → headroom multiplier; readable failure message.
- **Duplicate sends** → idempotency key + UI disable while pending.

---

## 11) Rollback plan

- Feature‑flag the terminal execution branch.
- Revert to chat‑only mode if integration tests fail.

---

## 12) Milestones

- **M1 (Day 1–2)**: AI parse + sanitize + schema; terminal branching; normalization.
- **M2 (Day 3–4)**: ZeroDev client wiring; send tx on Base Sepolia; acceptance tests green.
- **M3 (Day 5)**: Idempotency; error taxonomy polish; docs.
- **M4 (opt.)**: Enable Base mainnet behind env flag.

---

**Hand‑off to Claude Code**

- Run: `/generate-prp INITIAL.md` → review PRP → `/execute-prp PRPs/native-transfer-base.md`.
- Ensure all acceptance criteria pass before merging.
