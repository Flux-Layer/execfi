# CLI State Machine — Spec & Scaffold (ExecFi)

> Drop-in plan to refactor the terminal into a **hierarchical state machine** (HSM) with a reducer + effects runtime. Matches contracts in `INITIAL.md` and `AGENTS.md` (Privy Smart Accounts).

---

## 1) Objectives

- Deterministic transitions, cancellable async work
- Declarative flows (add steps, not if/else)
- Clean interrupt/back/ retry handling
- Headless: usable by simple CLI or richer TUI

---

## 2) Top-level Modes (HSM)

```
ROOT
├─ IDLE                // waiting for input (free prompt, slash-commands)
├─ FLOW                // multi-step op (transfer/swap/bridge)
│  ├─ parse
│  ├─ clarify
│  ├─ normalize
│  ├─ validate
│  ├─ plan
│  ├─ simulate
│  ├─ confirm
│  ├─ execute
│  ├─ monitor
│  ├─ success
│  └─ failure
├─ VIEW                // read-only pages (tx detail, balances, logs, settings)
├─ GUIDE               // interactive help/tutorial
└─ OVERLAY*            // modal confirm, toasts; separate stack
```

---

## 3) TypeScript State Schema

```ts
// src/cli/state/types.ts
export type Mode = "IDLE" | "FLOW" | "VIEW" | "GUIDE";

export type FlowName = "transfer" | "swap" | "bridge" | "bridge-swap";

export type FlowStep =
  | "parse"
  | "clarify"
  | "normalize"
  | "validate"
  | "plan"
  | "simulate"
  | "confirm"
  | "execute"
  | "monitor"
  | "success"
  | "failure";

export type Overlay =
  | { kind: "confirm"; message: string; onYes: AppEvent; onNo: AppEvent }
  | {
      kind: "toast";
      level: "info" | "warn" | "error";
      text: string;
      ttlMs: number;
    };

export type ViewPage =
  | { kind: "tx-detail"; txHash: string }
  | { kind: "balances" }
  | { kind: "logs" }
  | { kind: "settings" };

export type CoreContext = {
  userId: string;
  chainId: number; // default Base 8453
  saAddress?: `0x${string}`;
  idempotency: Map<string, number>; // promptKey -> minute bucket
};

export type FlowContext = {
  name: FlowName;
  step: FlowStep;
  raw?: string; // raw prompt
  intent?: IntentSuccess["intent"];
  norm?: NormalizedIntent; // from AGENTS.md
  plan?: any; // planner output
  sim?: any; // simulator output
  exec?: { hash?: `0x${string}`; submittedAt?: number };
  error?: { code: string; message: string; detail?: unknown };
};

export type AppState = {
  mode: Mode;
  flow?: FlowContext;
  viewStack: ViewPage[];
  overlays: Overlay[];
  core: CoreContext;
};
```

---

## 4) Event Model

```ts
// src/cli/state/events.ts
export type AppEvent =
  | { type: "INPUT.SUBMIT"; text: string }
  | { type: "INTENT.OK"; intent: IntentSuccess["intent"] }
  | { type: "INTENT.CLARIFY"; prompt: string; missing: string[] }
  | { type: "NORMALIZE.OK"; norm: NormalizedIntent }
  | { type: "NORMALIZE.FAIL"; error: AppError }
  | { type: "VALIDATE.OK" }
  | { type: "VALIDATE.FAIL"; error: AppError }
  | { type: "PLAN.OK"; plan: any }
  | { type: "PLAN.FAIL"; error: AppError }
  | { type: "SIM.OK"; sim: any }
  | { type: "SIM.FAIL"; error: AppError }
  | { type: "CONFIRM.YES" }
  | { type: "CONFIRM.NO" }
  | { type: "EXEC.OK"; hash: `0x${string}` }
  | { type: "EXEC.FAIL"; error: AppError }
  | { type: "MONITOR.OK" }
  | { type: "MONITOR.FAIL"; error: AppError }
  | { type: "FLOW.CANCEL" }
  | { type: "FLOW.BACK" }
  | { type: "FLOW.RETRY" }
  | { type: "NAV.VIEW.PUSH"; page: ViewPage }
  | { type: "NAV.VIEW.POP" }
  | { type: "OVERLAY.PUSH"; overlay: Overlay }
  | { type: "OVERLAY.POP" }
  | { type: "APP.TICK" }
  | { type: "APP.INIT" };
```

---

## 5) Reducer (pure) + Effects (async)

```ts
// src/cli/state/reducer.ts
export function reducer(s: AppState, e: AppEvent): AppState {
  // IDLE → FLOW.parse
  if (s.mode === "IDLE" && e.type === "INPUT.SUBMIT") {
    return {
      ...s,
      mode: "FLOW",
      flow: { name: inferFlowName(e.text), step: "parse", raw: e.text },
    };
  }

  // FLOW.parse reactions
  if (s.mode === "FLOW" && s.flow?.step === "parse") {
    if (e.type === "INTENT.OK")
      return {
        ...s,
        flow: { ...s.flow!, step: "normalize", intent: e.intent },
      };
    if (e.type === "INTENT.CLARIFY")
      return {
        ...s,
        flow: {
          ...s.flow!,
          step: "clarify",
          error: {
            code: "MISSING_FIELDS",
            message: e.prompt,
            detail: e.missing,
          },
        },
      };
  }

  // ...similar guards for normalize/validate/plan/simulate/confirm/execute/monitor...

  if (e.type === "FLOW.CANCEL") return { ...s, mode: "IDLE", flow: undefined };
  if (e.type === "NAV.VIEW.PUSH")
    return { ...s, viewStack: [...s.viewStack, e.page] };
  if (e.type === "NAV.VIEW.POP")
    return { ...s, viewStack: s.viewStack.slice(0, -1) };
  if (e.type === "OVERLAY.PUSH")
    return { ...s, overlays: [...s.overlays, e.overlay] };
  if (e.type === "OVERLAY.POP")
    return { ...s, overlays: s.overlays.slice(0, -1) };

  return s;
}
```

```ts
// src/cli/state/effects.ts
export type Dispatch = (e: AppEvent) => void;

export function stepChanged(prev: AppState, next: AppState) {
  return prev.mode !== next.mode || prev.flow?.step !== next.flow?.step;
}

export function effectRunner(store: {
  getState: () => AppState;
  dispatch: Dispatch;
  subscribe: (fn: (p: AppState, n: AppState) => void) => () => void;
}) {
  let ctrl = new AbortController();
  store.subscribe((prev, next) => {
    if (!stepChanged(prev, next)) return;
    ctrl.abort();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    const flow = next.flow;

    if (next.mode === "FLOW" && flow) {
      const def = FLOWS[flow.name]?.[flow.step];
      def?.onEnter?.(flow, next.core, store.dispatch, signal);
    }
  });
}
```

---

## 6) Declarative Flow DSL

```ts
// src/cli/state/flows.ts
export type StepDef = {
  onEnter?: (
    ctx: FlowContext,
    core: CoreContext,
    dispatch: Dispatch,
    signal: AbortSignal,
  ) => void;
  onEvent?: (s: AppState, e: AppEvent) => AppState;
  next?: (ctx: FlowContext) => FlowStep;
};

export type FlowDef = Record<FlowStep, StepDef>;

export const transferFlow: FlowDef = {
  parse: { onEnter: parseIntentFx },
  clarify: { onEnter: clarifyToastFx },
  normalize: { onEnter: normalizeFx },
  validate: { onEnter: validateFx },
  plan: { onEnter: skipFx }, // native transfer can skip plan
  simulate: { onEnter: simulateGasFx },
  confirm: { onEnter: confirmOverlayFx },
  execute: { onEnter: executePrivyFx },
  monitor: { onEnter: monitorFx },
  success: { onEnter: successFx },
  failure: { onEnter: failureFx },
};

export const FLOWS: Record<FlowName, FlowDef> = {
  transfer: transferFlow,
  // swap: swapFlow, bridge: bridgeFlow...
};
```

---

## 7) Effects — Reference Implementations

```ts
// src/cli/effects/intent.ts
export const parseIntentFx: StepDef["onEnter"] = async (
  ctx,
  core,
  dispatch,
  signal,
) => {
  try {
    const res = await callLLMIntent(ctx.raw!, { signal });
    if (signal.aborted) return;
    return res.ok
      ? dispatch({ type: "INTENT.OK", intent: res.intent })
      : dispatch({
          type: "INTENT.CLARIFY",
          prompt: res.clarify,
          missing: res.missing,
        });
  } catch (err) {
    if (!signal.aborted)
      dispatch({
        type: "INTENT.CLARIFY",
        prompt: "Please clarify.",
        missing: ["action"],
      });
  }
};
```

```ts
// src/cli/effects/normalize.ts
export const normalizeFx: StepDef["onEnter"] = async (
  ctx,
  core,
  dispatch,
  signal,
) => {
  try {
    const norm = await normalizeIntent(ctx.intent!); // uses AGENTS.md rules
    if (!signal.aborted) dispatch({ type: "NORMALIZE.OK", norm });
  } catch (error) {
    if (!signal.aborted) dispatch({ type: "NORMALIZE.FAIL", error });
  }
};
```

```ts
// src/cli/effects/validate.ts
export const validateFx: StepDef["onEnter"] = async (
  ctx,
  core,
  dispatch,
  signal,
) => {
  try {
    await validateNorm(ctx.norm!, core);
    if (!signal.aborted) dispatch({ type: "VALIDATE.OK" });
  } catch (error) {
    if (!signal.aborted) dispatch({ type: "VALIDATE.FAIL", error });
  }
};
```

```ts
// src/cli/effects/simulate.ts
export const simulateGasFx: StepDef["onEnter"] = async (
  ctx,
  core,
  dispatch,
  signal,
) => {
  try {
    const sim = await simulateGas(ctx.norm!, core);
    if (!signal.aborted) dispatch({ type: "SIM.OK", sim });
  } catch (error) {
    if (!signal.aborted) dispatch({ type: "SIM.FAIL", error });
  }
};
```

```ts
// src/cli/effects/confirm.ts
export const confirmOverlayFx: StepDef["onEnter"] = (ctx, core, dispatch) => {
  dispatch({
    type: "OVERLAY.PUSH",
    overlay: {
      kind: "confirm",
      message: `Send ${prettyAmount(ctx.norm!)} to ${short(ctx.norm!.to)} on ${core.chainId}?`,
      onYes: { type: "CONFIRM.YES" },
      onNo: { type: "CONFIRM.NO" },
    },
  });
};
```

```ts
// src/cli/effects/execute.ts
export const executePrivyFx: StepDef["onEnter"] = async (
  ctx,
  core,
  dispatch,
  signal,
) => {
  try {
    const key = makeIdempotencyKey(core.userId, core.chainId, ctx.norm!);
    if (seenWithin(core.idempotency, key, 60_000)) {
      return dispatch({ type: "EXEC.OK", hash: await lastHashFor(key) });
    }

    const { saClient } = await getPrivySAClient(core.chainId); // wraps Privy Smart Account
    const hash = await saClient.sendUserOperation({
      to: ctx.norm!.to!,
      value: ctx.norm!.amountWei,
    });
    if (!signal.aborted) dispatch({ type: "EXEC.OK", hash });
  } catch (error) {
    if (!signal.aborted) dispatch({ type: "EXEC.FAIL", error });
  }
};
```

```ts
// src/cli/effects/monitor.ts
export const monitorFx: StepDef["onEnter"] = async (
  ctx,
  core,
  dispatch,
  signal,
) => {
  try {
    const ok = await waitForReceipt(ctx.exec!.hash!, { signal });
    if (!signal.aborted)
      dispatch(
        ok
          ? { type: "MONITOR.OK" }
          : {
              type: "MONITOR.FAIL",
              error: { code: "RECEIPT_TIMEOUT", message: "Timed out" },
            },
      );
  } catch (error) {
    if (!signal.aborted) dispatch({ type: "MONITOR.FAIL", error });
  }
};
```

```ts
// src/cli/effects/feedback.ts
export const successFx: StepDef["onEnter"] = (ctx, core, dispatch) => {
  dispatch({
    type: "OVERLAY.PUSH",
    overlay: {
      kind: "toast",
      level: "info",
      text: `✅ Sent — ${ctx.exec?.hash}`,
      ttlMs: 6000,
    },
  });
};

export const failureFx: StepDef["onEnter"] = (ctx, core, dispatch) => {
  dispatch({
    type: "OVERLAY.PUSH",
    overlay: {
      kind: "toast",
      level: "error",
      text: readableError(ctx.error),
      ttlMs: 6000,
    },
  });
};
```

---

## 8) Renderer Contract (headless-friendly)

```ts
// src/cli/render.ts
export function render(state: AppState): string[] {
  const lines: string[] = [];
  lines.push(header(state));

  if (state.mode === "IDLE") lines.push("Type a prompt or /help …");
  if (state.mode === "FLOW") lines.push(flowCopy(state.flow!));
  if (state.mode === "VIEW") lines.push(viewCopy(state.viewStack.at(-1)!));

  state.overlays.forEach((ov) => lines.push(renderOverlay(ov)));
  return lines;
}
```

---

## 9) Commands → Events

- `/help` → show GUIDE
- `/settings` → `NAV.VIEW.PUSH {kind:"settings"}`
- `/balances` → `NAV.VIEW.PUSH {kind:"balances"}`
- `/tx <hash>` → `NAV.VIEW.PUSH {kind:"tx-detail", txHash}`
- `/cancel` → `FLOW.CANCEL`
- `/retry` → `FLOW.RETRY`
- `/back` → `FLOW.BACK`
- `/chain base-sepolia` → update `core.chainId` + toast

Implement a tiny command parser → emit `AppEvent`.

---

## 10) Error Mapping → State Recovery

- `ADDRESS_INVALID`, `CHAIN_UNSUPPORTED` → `clarify` with targeted question
- `INSUFFICIENT_FUNDS` → remain in `validate` with suggested fix
- `SIMULATION_FAILED`, `BUNDLER_REJECTED` → rewind to `simulate`/`confirm`
- `EXEC.FAIL` → `failure` + quick actions (retry, view tx)

Idempotency: compute `(userId, chainId, to, amountWei, minuteBucket)` on entering `execute`; short-circuit if duplicate.

---

## 11) Persistence & Telemetry

- Persist `{ mode, flow?, viewStack }` to `~/.execfi/state.json` on each transition
- On `APP.INIT`, offer to resume last flow
- Journal: `{ userId, saAddress, intentKind, chainId, to, amountWei, step, hash?, error? }`

---

## 12) Test Harness

- **Reducer golden tests**: event sequences → snapshot state
- **Effect fakes**: stub LLM/viem/privy client; assert dispatches + cancellation
- **Property tests**: any FLOW ends in {success|failure|cancel}; no dead-ends
- **Navigation tests**: overlay close/back/cancel anywhere

---

## 13) Minimal Store Scaffold

```ts
// src/cli/state/store.ts
export function createStore(initial: AppState) {
  let state = initial;
  const subs = new Set<(p: AppState, n: AppState) => void>();
  const dispatch = (e: AppEvent) => {
    const prev = state;
    const next = reducer(state, e);
    state = next;
    subs.forEach((fn) => fn(prev, next));
  };
  return {
    getState: () => state,
    dispatch,
    subscribe: (fn: (p: AppState, n: AppState) => void) => (
      subs.add(fn),
      () => subs.delete(fn)
    ),
  };
}
```

---

## 14) Integration Points

- **Intent/Normalize/Validate/Simulate/Execute**: reuse logic from `AGENTS.md` contracts and `INITIAL.md` acceptance criteria
- **Execute**: Privy Smart Account → `sendUserOperation({ to, value })`
- **Monitor**: viem waitForTransactionReceipt

---

## 15) Roadmap Hooks

- Session mode: add `SESSION_FLOW_*` with `delegateWallet` + `addSessionSigners`
- Swap/Bridge flows: same steps, add real `plan` and `LI.FI` execution
- Display: optional TUI (Ink/Blessed) using the same reducer/events

---

**Drop this folder layout into your repo** and point the AI coding agent to scaffold implementation:

```
src/cli/state/
  types.ts
  events.ts
  reducer.ts
  effects.ts
  flows.ts
  store.ts
src/cli/effects/
  intent.ts
  normalize.ts
  validate.ts
  simulate.ts
  confirm.ts
  execute.ts
  monitor.ts
  feedback.ts
src/cli/render.ts
```
