# INITIAL.md — MVP Feature Spec: Prompt→Native Transfer on **Base** (Smart-Account Only, Privy)

> This is the single source of truth for the **next shippable increment**. It is scoped to _native ETH transfers on Base_ executed from the terminal via our **Privy Smart Accounts (ERC-4337)** stack. No paymaster in MVP (user pays gas). This file is designed for Claude Code’s `/generate-prp` → `/execute-prp` flow.

---

## 0) Summary

**GRAB** all informations from the docummentations provided in `DOCS_REFERENCES.md` file.

**Goal:** From the terminal, a user types a prompt like `transfer 0.002 ETH on base to 0x…` → app parses intent → validates → executes via the user’s **Privy Smart Account** on **Base mainnet (8453)** → shows explorer link. Works reliably on **Base Sepolia** first, then **Base mainnet** behind an env flag.
ERC-20 transfers, swaps, bridges, paymaster sponsorship, session keys.

---

## 1) Functional requirements

1. **Prompt ingestion**: After login (Privy email+OTP), terminal accepts free-form prompts.
2. **Intent parse (Claude/OpenRouter)**: LLM returns **JSON-only** in the Intent v1.1/1.2 schema (see CLAUDE.md/AGENTS.md). If missing fields → model returns a **clarify** JSON.
3. **Sanitization & validation**:
   - Sanitize AI output (`parseAiJson`), validate with Zod schema.
   - Normalize to `{ chainId, amountWei, to }` for native transfer.
   - Validate: supported chain (Base 8453), EIP-55 checksummed recipient, amount > 0, balance ≥ value + gas headroom, daily/per-tx caps (config-driven; allow disable via `.env`).

4. **Execution (AA)**:
   - Build **Privy Smart Account client** using the user’s embedded EOA (EIP-1193 provider from Privy).
   - `saClient.sendUserOperation({ to, value })` (no data).
   - First tx **auto-deploys** the smart account if not yet deployed.

5. **UX**:
   - Show **normalized summary** before executing (optional confirm gate off by default; toggle via env).
   - On success: `✅ Sent 0.002 ETH on Base — hash 0x…` with clickable explorer link.
   - On failure: single-line actionable error (see taxonomy).

6. **Idempotency**: Same prompt within 60s must not double-send (derive an idempotency key; in-memory for now).
7. **Observability**: Log `{ userId, saAddress, promptId, norm, txHash?, status, error? }` (no secrets). Optional Sentry hook.

---

## 2) Non-functional requirements

- **Security**: Non-custodial; no server-side user keys; no logging secrets; contract/chain allowlists.
- **Determinism**: Strict JSON contracts; TypeScript strict; no silent fallbacks.
- **Performance**: Parse ≤ 2.5s; tx hash round-trip ≤ 8s (testnets).
- **Resilience**: Clear errors for off-policy JSON, insufficient funds, bundler rejections; retry LLM once with stricter instruction.

---

## 3) Contracts (copy-exact)

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

Authenticated state reached → terminal switches to chat mode.

User types prompt.

If ok\:false clarify → render question inline and accept next line.

If ok\:true:

Render summary: You’re sending 0.002 ETH on Base to 0x….

(Optional CONFIRM_BEFORE_SEND=true) ask Type YES to confirm.

Execute; show spinner; then success line with explorer URL or error line.

Copy rules: terse, friendly; one-line success/error; no stack traces.

---

## 5) Implementation plan (files & steps)

A) AI layer

- `/src/lib/ai/parse.ts` — parseAiJson(raw: string).
- `/src/lib/ai/intent.ts` — parseIntent(prompt) calling OpenRouter.
- `/src/lib/ai/schema.ts` — Zod schema.

B) Normalization & validation

- `/src/lib/normalize.ts` — resolve chainId, parse amount, checksum to.
- `/src/lib/validation.ts` — balance check via Viem (Base), 110% gas buffer, per-tx/day caps.

C) AA wiring (client)

- `/src/hooks/usePrivySA.ts` — Build Privy Smart Account client from embedded EOA. Export { client, saAddress }.
- Harden usePrivyEOA readiness and ensure single-flight wallet creation.

D) Orchestrator glue

- `/src/lib/execute.ts` — executeNativeTransfer(client, norm): Promise\<string /\* txHash \*/>.

E) Idempotency & telemetry

- `/src/lib/idempotency.ts` — in-memory guard.
- `/src/lib/telemetry.ts` — optional Sentry/console logging.

F) Explorer helpers

- `/src/lib/explorer.ts` — txUrl(chainId, hash): string.

---

## 6) Env & config

```
NEXT_PUBLIC_PRIVY_APP_ID=...
NEXT_PUBLIC_PRIVY_APP_SECRET=...
##### Optional infra pulled from Privy Dashboard config; override if needed:
NEXT_PUBLIC_RPC_ALCHEMY_KEY=...
OPENROUTER_API_KEY=...
APP_CHAIN_DEFAULT=base
CONFIRM_BEFORE_SEND=false
DAILY_SPEND_LIMIT_USD=100
```

---

## 7) Acceptance criteria

- User logs in (email/OTP). Terminal ready.
- Prompt transfer 0.001 ETH on base to 0x… executes via Privy Smart Account on Base Sepolia and prints a valid explorer link.
- Smart Account auto-deployment: if the user’s SA is undeployed, the first transaction deploys it (no extra UX).
- Handles clarify JSON correctly (e.g., missing chain, missing recipient).
- Validation passes: checksummed recipient, amount > 0, sufficient balance + gas headroom.
- Idempotency works: resubmitting the same prompt within 60s does not double-send.
- No server-side user key storage or secret logging; only addresses and tx receipts may be logged.
- Types are strict; lint/tests pass locally and in CI.
- Bundler success: tx is accepted and included within SLA (≤ 8s on testnet).

**Stretch goals**

- Optional confirmation gate (CONFIRM_BEFORE_SEND).
- Graceful error mapping for common bundler errors (insufficient gas, invalid nonce, simulation failed).

---

## 8) Tests

- **Unit**: AI JSON parsing, schema validation, normalization, validation edge cases.
- **Integration**: Send small native transfer on Base Sepolia.
- **E2E**: Prompt → success line with explorer link.

---

## 9) Error taxonomy

- `OFF_POLICY_JSON`: “I couldn’t parse that as a transaction. Try: …”
- `MISSING_FIELDS`: echo clarify question.
- `CHAIN_UNSUPPORTED`: “Only Base supported for now.”
- `ADDRESS_INVALID`: “Recipient must be a checksummed 0x address.”
- `INSUFFICIENT_FUNDS`: “Balance too low for amount + gas.”
- `BUNDLER_REJECTED` / `SIMULATION_FAILED`: “Transaction failed to validate.”

---

## 10) Risks & mitigations

- **LLM off-policy** → enforce schema + retry once.
- **Bundler variance** → pin to the Privy-configured bundler; surface concise errors.
- **Gas spikes** → add buffer; show readable fee errors.
- **Duplicates** → idempotency key.

---

## 11) Rollback plan

- Feature-flag the execution path.
- Revert to chat-only if integration fails.

---

## 12) Milestones

- **M1 (Day 1–2)**: AI layer + schemas + terminal branching.
- **M2 (Day 3–4)**: Privy SA wiring + Base Sepolia integration.
- **M3 (Day 5)**: Idempotency + error taxonomy polish + docs.
- **M4**: Enable Base mainnet via env.

---

## 13) Future: Session Keys (Privy Session Signers + Policies)

**Motivation**: background/CLI transactions after login without repeated popups.
**Mechanism**:

- Provision a Privy session signer (server-owned key) once.
- On user login, call delegateWallet(userWallet) and attach the signer with per-user Policies (contract allowlist, spend caps, TTL).
- Revoke on logout or by policy expiry; rotate signer as needed.

**Runtime flow**:

1. Login → delegateWallet(userWallet)
2. addSessionSigners({ address: userWallet, signers: \[{ signerId, policyIds: \[...] }] })
3. Server/CLI signs under enforced policies.

**Note**: Same signer can be attached to many users; Privy enforces per-user scopes.

---

**Hand-off to Claude Code**

- Run: /generate-prp INITIAL.md → review PRP → /execute-prp PRPs/native-transfer-base.md.
