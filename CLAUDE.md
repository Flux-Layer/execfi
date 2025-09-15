# CLAUDE.md — Project Rules & Operability Guide (Kentank)

> **Purpose.** This file is the *contract* between our codebase and Claude Code / Claude API. It encodes how Claude should read context, plan, write code, and emit machine‑parsable outputs for our **prompt→transaction** DeFi app built on **Privy (embedded EOA)** + **ZeroDev/Kernel (EP‑0.7, Kernel v3.1)** + **LI.FI**.
>
> **Prime directive.** *Be predictable.* Prefer determinism, schemas, and tests over cleverness.

---

## 0) Operating modes

* **Intent/Planning mode (API calls via OpenRouter)**

  * Task: turn terminal text into **strict JSON** (Intent v1.1) *or* a single **clarify** object.
  * Output: **JSON only**, no prose, no code fences.
  * Temperature: `0`.

* **Coding mode (Claude Code in IDE)**

  * Task: read `INITIAL.md` → generate PRP → implement against repo.
  * Constraints: TypeScript strict, Viem, React/Next, client‑only for Privy/AA wiring.
  * Deliverables: code + tests + docs according to acceptance criteria.

---

## 1) Context ingestion order (always read in this order)

1. `INITIAL.md` (current feature scope + acceptance tests)
2. `agents.md` (end‑to‑end flows: Parser → Normalizer → Validator → Executor)
3. `CONTEXT-CLAUDE.md` or README (projectized context‑engineering rules)
4. This `CLAUDE.md` (global guardrails & coding rules)
5. `/examples/**` (copy patterns; do not invent new shapes)
6. Relevant code paths under `/hooks`, `/lib`, `/app`, `/api`

If conflicts arise, **INITIAL.md > agents.md > CLAUDE.md**.

---

## 2) Canonical contracts

### 2.1 Intent JSON (v1.1)

* **Success**

```json
{"ok":true,"intent":{"action":"transfer|swap|bridge|bridge_swap","chain":"base|…|chainId","token":{"type":"native","symbol":"ETH","decimals":18},"amount":"0.002","recipient":"0x… or ENS"}}
```

* **Clarify**

```json
{"ok":false,"clarify":"short question","missing":["field", "field"]}
```

* **Rules**: no invented data; if ambiguous → clarify; if “max” → `amount:"MAX"`.

### 2.2 Normalizer output (code side)

```ts
{ chainId:number, token:{symbol:string, address?:`0x${string}`, decimals:number}, amountWei:bigint, to?:`0x${string}` }
```

### 2.3 Execution interfaces

* **Native transfer**: `kernelClient.sendTransaction({ to, value, data?:"0x" })`
* **LI.FI**: `getRoutes` → pick → `executeRoute(kernelClient as any, route)`

### 2.4 AI JSON sanitizer

* Use `parseAiJson(raw)` from `agents.md` Appendix B. If parse fails → treat as OFF\_POLICY and retry once with stricter instruction.

---

## 3) Guardrails & scope

* **Non‑custodial**: No server‑side secrets or key material. Privy holds keys; we only consume the EIP‑1193 provider client‑side.
* **Smart‑accounts‑only**: User’s canonical address is their **Kernel** smart account.
* **Supported chains** (MVP): Base(8453), Ethereum Mainnet(1), Polygon(137), Arbitrum(42161), Optimism(10), Avalanche(43114). Default to **Base**.
* **Costs**: MVP operates **without paymaster**. Users pay gas. If paymaster is configured via env, treat as optional.
* **Quotes**: Required for swaps/bridges only. Not for native/ERC‑20 transfers.
* **Safety**: enforce checksum, non‑zero address, balance & gas headroom checks, per‑tx/day caps, contract allowlists.

---

## 4) Strong opinions for correctness

* **Determinism over cleverness**: no hidden magic; explicit chain registry and token metadata.
* **Small files**: Prefer composable helpers. Keep UI logic (terminal) separate from execution logic.
* **Client boundaries**: Privy/ZeroDev calls are **client‑only** (`"use client"`). No SSR usage of wallet providers.
* **Version pinning**: EntryPoint **0.7** + Kernel **v3.1** must be explicit (`getEntryPoint("0.7"), KERNEL_V3_1`).
* **ZeroDev signer**: Convert Privy EIP‑1193 with `toOwner` (permissionless). Do **not** import non‑existent helpers from `@zerodev/sdk`.

---

## 5) Coding rules

* **Language/stack**: TypeScript (strict), Viem for chains/units, React/Next.js app router.
* **Style**: ESLint + Prettier (defaults). No `any` unless strictly isolated with comment.
* **Imports**: Group external → internal. No circular deps. No deep relative hell (`../../..`).
* **Config via env**: `NEXT_PUBLIC_BUNDLER_RPC`, `NEXT_PUBLIC_PAYMASTER_RPC` (optional), `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_LIFI_API_KEY`.
* **Errors**: propagate typed `Error` with short user‑facing messages; log low‑level details once.
* **DX**: Add inline JSDoc on exported functions; include examples where non‑obvious.

---

## 6) ZeroDev × Privy wiring (canonical pattern)

```ts
// Client‑only
import { http, createPublicClient } from "viem";
import { base } from "viem/chains";
import { toOwner } from "permissionless";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { createKernelAccount, createKernelAccountClient } from "@zerodev/sdk";
import { getEntryPoint, KERNEL_V3_1 } from "@zerodev/sdk/constants";

export async function getKernelClientFromPrivyWallet(privyWallet:any) {
  const eip1193 = await privyWallet.getEthereumProvider();
  const owner = await toOwner({ owner: eip1193, address: privyWallet.address });

  const chain = base; // parametrize later
  const entryPoint = getEntryPoint("0.7");
  const publicClient = createPublicClient({ chain, transport: http(process.env.NEXT_PUBLIC_BUNDLER_RPC!) });

  const ecdsa = await signerToEcdsaValidator(publicClient, { signer: owner, entryPoint, kernelVersion: KERNEL_V3_1 });
  const account = await createKernelAccount(publicClient, { plugins: { sudo: ecdsa }, entryPoint, kernelVersion: KERNEL_V3_1 });

  return createKernelAccountClient({
    account,
    chain,
    client: publicClient,
    bundlerTransport: http(process.env.NEXT_PUBLIC_BUNDLER_RPC!),
    // paymaster: { rpcUrl: process.env.NEXT_PUBLIC_PAYMASTER_RPC! }, // optional
  });
}
```

**Gotchas**: network mismatch (offer switch), first userOp deploys the account, no paymaster → user must have gas on that chain.

---

## 7) Terminal UX contract

* **Success line**: `✅ Sent 0.002 ETH on Base — hash 0x…` (make hash clickable in UI).
* **Validation error**: concise + actionable (e.g., "Recipient is not a checksummed 0x address").
* **Waiting**: single spinner line; stream LI.FI route status when available.
* **Confirm gate (optional)**: Ask `yes/no` for large or first‑time recipients.

---

## 8) PRP workflow (Claude Code)

* **/generate-prp INITIAL.md** must produce a doc with:

  * Context summary (what, why, acceptance criteria)
  * File diffs plan (exact files to add/modify)
  * Validation gates (unit, integration)
  * Rollback plan (how to revert safely)

* **/execute-prp PRPs/<feature>.md** must:

  * Implement plan step‑by‑step
  * Run tests (unit + any configured e2e) and lint
  * Iterate until all gates pass
  * Summarize changes and manual steps (env vars, migrations)

---

## 9) Testing & validation

* **Unit**: intent parsing/normalization, checksum utilities, amount→wei.
* **Integration (devnet/testnet)**: Base Sepolia — native transfer happy path.
* **E2E smoke**: terminal prompt → tx hash shown; swap route selection returns summary.
* **Idempotency**: same prompt twice must not double‑send (use `promptId`).

Preferred test stack: Vitest + Testing Library for UI pieces.

---

## 10) Failure handling taxonomy

* `OFF_POLICY_JSON` – AI didn’t emit JSON → retry once with stricter system message
* `MISSING_FIELDS` – produce CLARIFY JSON
* `CHAIN_UNSUPPORTED` – list supported chains
* `INSUFFICIENT_FUNDS` – show short top‑up instruction
* `BUNDLER_REJECTED` / `SIMULATION_FAILED` – show compact reason, log full details

All user‑visible errors must be one‑liners.

---

## 11) Security & privacy

* Do not log secrets; redact anything that *looks* like a seed/private key.
* No server storage of keys; only addresses and public receipts.
* Maintain allowlists/denylists for tokens/contracts when adding LI.FI.
* Consider session keys (Kernel policies) later: TTL, spend caps, per‑contract allowlist.

---

## 12) Performance budgets

* Intent parse/clarify: Sonnet ≤ 3.5s (target 1.5–2.0s), Haiku ≤ 1.2s
* Terminal turnaround (native transfer): ≤ 8s to mined on testnet
* Bundle size: do not import heavy SDKs in server routes unnecessarily

---

## 13) When in doubt

* Prefer **clarify** over guessing.
* Prefer **small PRs** that hit acceptance criteria.
* Prefer **copying examples/** patterns exactly over inventing new abstractions.

---

## 14) Quick checklists

**Before emitting intent JSON**

* [ ] No prose, JSON only
* [ ] If ambiguous → clarify
* [ ] No invented addresses/amounts

**Before shipping code**

* [ ] Types are strict; no `any` leaks
* [ ] Kernel v3.1 + EP‑0.7 explicit
* [ ] Env‑driven RPCs; no hardcoded endpoints
* [ ] Unit tests pass locally

**Before sending a tx**

* [ ] Checksummed `to`
* [ ] `amountWei > 0` and ≤ balance‑gas
* [ ] Correct chainId

---

**TL;DR**: Claude, your outputs must be **deterministic**.

* API mode: **JSON only** per Intent v1.1
* Coding mode: follow **examples/**, build on **Privy + ZeroDev + LI.FI**, pass tests, and keep users safe.

