# Terminal Flow Control Flow Diagram

This document maps the terminal pipeline from the moment a user presses Enter in the prompt to the final system response. It traces reducer transitions, effect invocations, and side-channel updates (chat history, overlays, renders) that occur in `src/cli`.

## Legend
- **Rounded node**: user/UI interaction.
- **Rectangle**: reducer state transition.
- **Rhombus**: branch/condition.
- **Double border**: asynchronous effect (`onEnter`) managed by `createEffectRunner`.
- **Dashed edge**: implicit loop or repeated polling.
- **Gray text**: notable side-effects (chat update, overlay, chain switch, etc.).

## High-Level Stage Flow
```mermaid
flowchart TD
  A([User submits input via HSMPromptTerminal]) --> B[Reducer handles `INPUT.SUBMIT`]
  B --> C{Slash command?}
  C -- yes --> D[Reducer emits `COMMAND.EXECUTE`]
  D ==> E[[Effect runner parses & runs command]]
  E --> F[Command dispatches follow-up events / chat updates]
  F --> G[Reducer transitions view/flow or returns to IDLE]
  C -- no --> H[Reducer enters FLOW mode `step=parse`, stores raw prompt]
  H ==> I[[`parseIntentFx` (`parse` step)]]
  I --> J{Intent outcome}
  J -- Clarify --> K[Reducer sets `step=clarify`, queues clarification prompt]
  J -- Token pick --> L[Reducer stores token table & waits for user selection]
  J -- Success --> M[Reducer advances `step=normalize` with intent payload]
  K --> A
  L --> A
  M ==> N[[`normalizeFx` (`normalize` step)]]
  N --> O{Normalized?}
  O -- ok --> P[Reducer sets `step=validate` & caches norm]
  O -- fail --> Q[Reducer sets `step=failure` & captures error]
  P ==> R[[`validateFx`]]
  R --> S{Pass checks?}
  S -- ok --> T[Reducer sets `step=plan`]
  S -- fail --> Q
  T ==> U[[`plan*Fx` (swap/bridge-specific)]]
  U --> V{Plan ready?}
  V -- ok --> W[Reducer sets `step=simulate`]
  V -- fail --> Q
  W ==> X[[`simulateGasFx` or `skipFx`]]
  X --> Y{Auto-confirm keyword?}
  Y -- yes --> Z[Reducer jumps to `step=execute` & logs auto-confirm toast]
  Y -- no --> AA[Reducer sets `step=confirm`]
  AA ==> AB[[`confirm*Fx` pushes overlays/chat summary]]
  AB --> AC{User response}
  AC -- yes --> AD[Reducer sets `step=execute`]
  AC -- no --> AE[Reducer clears flow, returns to IDLE, logs "cancelled"]
  AD ==> AF[[`executePrivyFx`]]
  AF --> AG{Execution result}
  AG -- ok --> AH[Reducer sets `step=monitor` & stores tx hash]
  AG -- fail --> Q
  AH ==> AI[[`monitorFx` polls status]]
  AI -.-> AI
  AI --> AJ{Final status}
  AJ -- confirmed --> AK[Reducer sets `step=success`]
  AJ -- failed --> Q
  AK ==> AL[[`successFx` logs completion, toast]]
  Q ==> AM[[`failureFx` logs error toast/chat]]
  AL --> AN[Effect runner schedules `FLOW.CANCEL` → IDLE]
  AM --> AN
```

## Parse & Command Handling Details
```mermaid
flowchart LR
  A([Input text]) --> B[Reducer `INPUT.SUBMIT`]
  B --> C{Starts with `/`?}
  C -- yes --> D[Reducer dispatches `COMMAND.EXECUTE`]
  D -.updates.-> E[State.lastCommand stamped]
  E ==> F[[Effect runner sees `lastCommand` change]]
  F --> G{`commandDef.parse(args)`}
  G -- error --> H[Dispatch `CHAT.ADD` (user echo + error), stay IDLE]
  G -- ok --> I[Dispatch `CHAT.ADD` with user command]
  I --> J{`commandDef.run` result}
  J -- sync --> K[Command raises events (e.g. `POLICY.UPDATE`, `FLOW.CANCEL`, `NAV.VIEW.PUSH`)]
  J -- promise --> L[[Await, on rejection push toast + `FLOW.CANCEL`]]
  C -- no --> M[Reducer begins flow, sets `flow.raw`, mode=FLOW]
  M ==> N[[`parseIntentFx`]]
  N --> O{Routing}
  O -- `/` recognized late --> F
  O -- `isIntentChat` --> P[Append assistant chat response]
  P --> Q[Dispatch `FLOW.CANCEL` (silent)]
  O -- `isIntentClarify` --> R[Dispatch `INTENT.CLARIFY` & question]
  R --> S[Reducer step=clarify, overlay toast + chat question]
  S --> T([User supplies clarification])
  T --> B
  O -- `isIntentTokenSelection` --> U[Dispatch `INTENT.TOKEN_SELECTION`]
  U --> V[Reducer stores options, prompts user]
  V --> W([User picks index])
  W --> X[Reducer `TOKEN.SELECT`, rebuilds intent, back to parse/normalize]
  O -- success --> Y[Dispatch `INTENT.OK`]
```

## Post-Normalization Pipeline
```mermaid
flowchart LR
  A[Reducer `step=validate`] ==> B[[`validateFx`]]
  B --> C{Auth & policy checks}
  C -- missing wallet/SA --> D[Dispatch `VALIDATE.FAIL` (auth toast + chat)]
  C -- policy block --> E[Dispatch `VALIDATE.FAIL` with violation details]
  C -- warn only --> F[Push warn toasts]
  F --> G[Run `validateIntent` for gas/balance]
  G -- success --> H[Dispatch `VALIDATE.OK`]
  H --> I[Reducer `step=plan`]
  I ==> J[[`planSwapFx`/`planBridgeFx`/`skipPlanFx`]]
  J --> K{Quote/route ready?}
  K -- ok --> L[Dispatch `PLAN.OK` (store route)]
  K -- fail --> M[Dispatch `PLAN.FAIL`]
  L --> N[Reducer `step=simulate`]
  N ==> O[[`simulateGasFx` or `skipFx`]]
  O --> P[Dispatch `SIM.OK` with gas metrics]
  P --> Q{`autoConfirm` keyword present?}
  Q -- yes --> R[Reducer `step=execute`, append auto-confirm chat]
  Q -- no --> S[Reducer `step=confirm`]
  S ==> T[[`confirm*Fx` builds overlay + chat summary]]
  T --> U{User choice}
  U -- confirm --> V[Reducer `step=execute`]
  U -- cancel --> W[Reducer resets to IDLE & chats "Transaction cancelled"]
  V ==> X[[`executePrivyFx`]]
  X --> Y{Chain aligned & idempotent?}
  Y -- chain switch needed --> Z[requestChainSwitch → switchWalletChain → waitForChainPropagation]
  Z --> AA
  Y -- duplicate detected --> AB[Dispatch `EXEC.FAIL` duplicate error]
  AA --> AC[Call `executeIntent` with mode-specific client]
  AC -- ok --> AD[Dispatch `EXEC.OK` (hash, explorer URL)]
  AC -- error --> AE[Dispatch `EXEC.FAIL`]
  AD --> AF[Reducer `step=monitor`]
  AF ==> AG[[`monitorFx` poll until final status]]
  AG --> AH{Chain confirmation?}
  AH -- confirmed --> AI[Dispatch `MONITOR.OK`]
  AH -- timeouts/errors --> AJ[Dispatch `MONITOR.FAIL`]
  AI --> AK[Reducer `step=success`] ==> AL[[`successFx` → chat success message, toast, policy tracking]]
  AJ --> AM[Reducer `step=failure`] ==> AN[[`failureFx` → chat error, overlays]]
  AL --> AO[Effect runner schedules delayed `FLOW.CANCEL`]
  AN --> AO
  AO --> AP[Reducer returns to IDLE, clears overlays/view stack]
```

## Supporting Mechanics
- **Effect orchestration** (`src/cli/state/effects.ts:19`) – `createEffectRunner` watches for step changes, aborts the previous `AbortController`, and invokes the new step’s `onEnter`. It also auto-transitions terminal steps by dispatching `${step}.OK` and schedules flow teardown after success/failure.
- **Chat stream** (`src/cli/state/reducer.ts:76`) – every user/assistant message is appended to `chatHistory`, which drives `HSMChatHistory` and the textual logs rendered in `render.ts`.
- **Overlays** (`confirm*Fx`, `clarifyToastFx`, `successFx`, `failureFx`) – toasts and confirm modals are pushed via `OVERLAY.PUSH` and cleaned up by `APP.TICK` timers.
- **Token selection loop** (`INTENT.TOKEN_SELECTION` & `TOKEN.SELECT`) – normalization reruns after each selection until an unambiguous token set is available.
- **Policy + idempotency** (`validateFx`, `executePrivyFx`) – before execution the system enforces policy limits and after success tracks volume via `policy.checker` while preventing duplicate prompts via `idempotency` helpers.
- **Rendering** (`src/cli/render.ts`) – the textual terminal header reflects `mode`, `flow.step`, and overlays, giving the user continual feedback on the current stage.

This diagram reflects the control flow implemented across `src/cli/state/reducer.ts`, `src/cli/state/flows.ts`, and the effect modules in `src/cli/effects/*`.
