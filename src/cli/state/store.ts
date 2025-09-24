// Store implementation for HSM state management
import type { AppState, AppEvent, Dispatch } from "./types";
import { reducer, createInitialState } from "./reducer";
import { createEffectRunner } from "./effects";
import type { FlowDef } from "./types";

export interface Store {
  getState: () => AppState;
  dispatch: Dispatch;
  subscribe: (fn: (prev: AppState, next: AppState) => void) => () => void;
  cleanup: () => void;
}

/**
 * Create store with HSM state management
 */
export function createStore(
  flows: Record<string, FlowDef>,
  initialState?: Partial<AppState>
): Store {
  let state = { ...createInitialState(), ...initialState };
  const subscribers = new Set<(prev: AppState, next: AppState) => void>();

  // Dispatch function
  const dispatch: Dispatch = (event: AppEvent) => {
    const prevState = state;
    const nextState = reducer(state, event);

    // Only update if state actually changed
    if (nextState !== prevState) {
      state = nextState;

      // Notify subscribers
      subscribers.forEach((subscriber) => {
        try {
          subscriber(prevState, nextState);
        } catch (error) {
          console.error("Subscriber error:", error);
        }
      });
    }
  };

  // Subscribe function
  const subscribe = (fn: (prev: AppState, next: AppState) => void) => {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  };

  // Create effect runner
  const effectRunner = createEffectRunner(flows, {
    getState: () => state,
    dispatch,
    subscribe,
  });

  // Auto-tick for overlay cleanup
  const tickInterval = setInterval(() => {
    dispatch({ type: "APP.TICK" });
  }, 1000);

  return {
    getState: () => state,
    dispatch,
    subscribe,
    cleanup: () => {
      effectRunner.cleanup();
      clearInterval(tickInterval);
      subscribers.clear();
    },
  };
}

/**
 * Store with React DevTools integration (if available)
 */
export function createStoreWithDevTools(
  flows: Record<string, FlowDef>,
  initialState?: Partial<AppState>
): Store {
  const store = createStore(flows, initialState);

  // Connect to Redux DevTools if available
  if (typeof window !== "undefined" && (window as any).__REDUX_DEVTOOLS_EXTENSION__) {
    const devTools = (window as any).__REDUX_DEVTOOLS_EXTENSION__.connect({
      name: "ExecFi HSM",
      features: {
        pause: true,
        lock: true,
        persist: true,
        export: true,
        import: "custom",
        jump: true,
        skip: true,
        reorder: true,
        dispatch: true,
        test: true,
      },
    });

    // Track state changes for DevTools
    let actionId = 0;
    const originalDispatch = store.dispatch;

    const wrappedDispatch: Dispatch = (event) => {
      try {
        // Safely serialize state for DevTools (handle BigInt)
        const safeState = JSON.parse(serializeWithBigInt(store.getState()));
        devTools.send(
          {
            type: event.type,
            payload: event,
            id: actionId++,
          },
          safeState
        );
      } catch (error) {
        console.warn("DevTools serialization error:", error);
        devTools.send(
          {
            type: event.type,
            payload: { error: "Serialization failed" },
            id: actionId++,
          },
          { mode: "ERROR", error: "State serialization failed" }
        );
      }
      return originalDispatch(event);
    };

    // Listen for DevTools messages
    devTools.subscribe((message: any) => {
      if (message.type === "DISPATCH" && message.state) {
        // Handle time travel debugging
        console.log("DevTools time travel:", message);
      }
    });

    try {
      const safeInitialState = JSON.parse(serializeWithBigInt(store.getState()));
      devTools.init(safeInitialState);
    } catch (error) {
      console.warn("DevTools init error:", error);
      devTools.init({ mode: "ERROR", error: "Initial state serialization failed" });
    }

    return {
      ...store,
      dispatch: wrappedDispatch,
    };
  }

  return store;
}

/**
 * Persistence helpers
 */
/**
 * Custom JSON serializer that handles BigInt values
 */
function serializeWithBigInt(obj: any): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === "bigint") {
      return { __type: "bigint", value: value.toString() };
    }
    return value;
  });
}

/**
 * Custom JSON deserializer that handles BigInt values
 */
function deserializeWithBigInt(str: string): any {
  return JSON.parse(str, (key, value) => {
    if (value && typeof value === "object" && value.__type === "bigint") {
      return BigInt(value.value);
    }
    return value;
  });
}

export function saveStateToStorage(state: AppState, key = "execfi-state"): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const persistedState = {
        mode: state.mode,
        flow: state.flow ? {
          ...state.flow,
          // Handle potential BigInt values in normalized intent
          norm: state.flow.norm ? {
            ...state.flow.norm,
            amountWei: state.flow.norm.amountWei, // Will be serialized as BigInt
          } : undefined,
        } : undefined,
        viewStack: state.viewStack,
        core: {
          ...state.core,
          // Don't persist the smart wallet client
          smartWalletClient: undefined,
          // Convert Map to array for serialization
          idempotency: Array.from(state.core.idempotency.entries()),
        },
      };
      window.localStorage.setItem(key, serializeWithBigInt(persistedState));
    }
  } catch (error) {
    console.warn("Failed to save state to storage:", error);
  }
}

export function loadStateFromStorage(key = "execfi-state"): Partial<AppState> | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        const parsed = deserializeWithBigInt(stored);

        // Restore Map from array
        if (parsed.core?.idempotency && Array.isArray(parsed.core.idempotency)) {
          parsed.core.idempotency = new Map(parsed.core.idempotency);
        }

        return parsed;
      }
    }
  } catch (error) {
    console.warn("Failed to load state from storage:", error);
    // Clear corrupted storage
    try {
      window.localStorage.removeItem(key);
    } catch {}
  }
  return null;
}

export function clearStateFromStorage(key = "execfi-state"): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch (error) {
    console.warn("Failed to clear state from storage:", error);
  }
}

/**
 * Store with automatic persistence
 */
export function createPersistedStore(
  flows: Record<string, FlowDef>,
  storageKey = "execfi-state"
): Store {
  // Load initial state from storage
  const persistedState = loadStateFromStorage(storageKey);
  const store = createStoreWithDevTools(flows, persistedState || {});

  // Auto-save on state changes (debounced)
  let saveTimeout: NodeJS.Timeout;
  store.subscribe((prev, next) => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveStateToStorage(next, storageKey);
    }, 1000); // Debounce saves
  });

  return store;
}