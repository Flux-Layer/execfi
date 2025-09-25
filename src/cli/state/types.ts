// Core HSM types for ExecFi terminal state machine
import type { Intent, IntentSuccess } from "@/lib/ai";
import type { NormalizedIntent } from "@/lib/normalize";

export type Mode = "IDLE" | "FLOW" | "VIEW" | "GUIDE" | "AUTH";

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
  | {
      kind: "confirm";
      message: string;
      onYes: AppEvent;
      onNo: AppEvent;
    }
  | {
      kind: "toast";
      level: "info" | "warn" | "error";
      text: string;
      ttlMs: number;
      id?: string;
    };

export type ViewPage =
  | { kind: "tx-detail"; txHash: string }
  | { kind: "balances" }
  | { kind: "logs" }
  | { kind: "settings" };

export type CoreContext = {
  userId?: string; // undefined when not authenticated
  chainId: number; // default Base 8453
  saAddress?: `0x${string}`;
  smartWalletClient?: any; // Privy Smart Wallet client
  idempotency: Map<string, number>; // promptKey -> minute bucket
};

export type AppError = {
  code: string;
  message: string;
  detail?: unknown;
  phase?: string;
};

export type FlowContext = {
  name: FlowName;
  step: FlowStep;
  raw?: string; // raw prompt
  intent?: IntentSuccess["intent"];
  norm?: NormalizedIntent;
  plan?: any; // planner output
  sim?: any; // simulator output
  exec?: {
    hash?: `0x${string}`;
    submittedAt?: number;
    explorerUrl?: string;
  };
  error?: AppError;
  // For token selection flow
  tokenSelection?: {
    message: string;
    tokens: Array<{
      id: number;
      chainId: number;
      address: string;
      name: string;
      symbol: string;
      logoURI?: string;
      verified?: boolean;
    }>;
  };
  selectedTokenIndex?: number;
};

export type AppState = {
  mode: Mode;
  flow?: FlowContext;
  viewStack: ViewPage[];
  overlays: Overlay[];
  core: CoreContext;
  // UI state
  inputText: string;
  chatHistory: Array<{
    role: "user" | "assistant";
    content: string | {
      type: string;
      [key: string]: any;
    };
    timestamp: number;
  }>;
};

// Event types following the spec
export type AppEvent =
  | { type: "INPUT.SUBMIT"; text: string }
  | { type: "INTENT.OK"; intent: IntentSuccess["intent"] }
  | { type: "INTENT.CLARIFY"; prompt: string; missing: string[] }
  | { type: "INTENT.TOKEN_SELECTION"; tokenSelection: FlowContext["tokenSelection"] }
  | { type: "TOKEN.SELECT"; index: number }
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
  | { type: "EXEC.OK"; hash: `0x${string}`; explorerUrl?: string }
  | { type: "EXEC.FAIL"; error: AppError }
  | { type: "MONITOR.OK" }
  | { type: "MONITOR.FAIL"; error: AppError }
  | { type: "FLOW.CANCEL" }
  | { type: "FLOW.BACK" }
  | { type: "FLOW.RETRY" }
  | { type: "FLOW.COMPLETE" }
  | { type: "FLOW.FAIL" }
  | { type: "NAV.VIEW.PUSH"; page: ViewPage }
  | { type: "NAV.VIEW.POP" }
  | { type: "OVERLAY.PUSH"; overlay: Overlay }
  | { type: "OVERLAY.POP"; id?: string }
  | { type: "APP.TICK" }
  | { type: "APP.INIT"; coreContext: CoreContext }
  | { type: "APP.RESET" }
  | { type: "INPUT.CHANGE"; text: string }
  | { type: "CHAT.ADD"; message: AppState["chatHistory"][0] }
  | { type: "AUTH.START" }
  | { type: "AUTH.STOP" };

// Helper types for effect definitions
export type Dispatch = (e: AppEvent) => void;

export type StepDef = {
  onEnter?: (
    ctx: FlowContext,
    core: CoreContext,
    dispatch: Dispatch,
    signal: AbortSignal,
  ) => void | Promise<void>;
  onEvent?: (s: AppState, e: AppEvent) => AppState | null;
  next?: (ctx: FlowContext) => FlowStep | null;
};

export type FlowDef = Partial<Record<FlowStep, StepDef>>;