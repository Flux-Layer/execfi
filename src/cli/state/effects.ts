// Effects runner - handles async side effects with cancellation support
import type { AppState, AppEvent, Dispatch, StepDef, FlowDef } from "./types";

/**
 * Check if step has changed between states OR if intent has been updated
 */
export function stepChanged(prev: AppState, next: AppState): boolean {
  return (
    prev.mode !== next.mode ||
    prev.flow?.step !== next.flow?.step ||
    prev.flow?.name !== next.flow?.name ||
    prev.flow?.intent !== next.flow?.intent // Check if intent object reference changed
  );
}

/**
 * Effect runner factory - manages async effects with cancellation
 */
export function createEffectRunner(
  flows: Record<string, FlowDef>,
  store: {
    getState: () => AppState;
    dispatch: Dispatch;
    subscribe: (fn: (prev: AppState, next: AppState) => void) => () => void;
  }
) {
  let currentController = new AbortController();

  // Subscribe to state changes and run effects
  const unsubscribe = store.subscribe((prev, next) => {
    // Handle command execution
    if (next.lastCommand &&
        next.lastCommand.timestamp !== prev.lastCommand?.timestamp &&
        next.lastCommand.result?.type === "COMMAND.EXECUTE") {

      const commandEvent = next.lastCommand.result;
      const { commandDef, args } = commandEvent;

      // Parse the command arguments
      const parseResult = commandDef.parse(args);
      if (!parseResult.ok) {
        store.dispatch({
          type: "CHAT.ADD",
          message: {
            role: "user",
            content: args,
            timestamp: Date.now(),
          },
        });
        store.dispatch({
          type: "CHAT.ADD",
          message: {
            role: "assistant",
            content: `❌ ${parseResult.error}`,
            timestamp: Date.now(),
          },
        });
        return;
      }

      // Add user message
      store.dispatch({
        type: "CHAT.ADD",
        message: {
          role: "user",
          content: args,
          timestamp: Date.now(),
        },
      });

      // Execute the command
      try {
        commandDef.run(parseResult.args, next.core, store.dispatch);
      } catch (error) {
        console.error("Command execution error:", error);
        store.dispatch({
          type: "CHAT.ADD",
          message: {
            role: "assistant",
            content: `❌ Command failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: Date.now(),
          },
        });
      }
      return;
    }

    if (!stepChanged(prev, next)) return;

    // Cancel previous effects
    currentController.abort();
    currentController = new AbortController();
    const signal = currentController.signal;

    // Run new effect if we're in a flow
    if (next.mode === "FLOW" && next.flow) {
      const flowDef = flows[next.flow.name];
      const stepDef = flowDef?.[next.flow.step];

      if (stepDef?.onEnter) {
        try {
          const result = stepDef.onEnter(
            next.flow,
            next.core,
            store.dispatch,
            signal
          );

          // Handle async effects
          if (result && typeof result.then === "function") {
            result.catch((error) => {
              if (!signal.aborted) {
                console.error(`Effect error in ${next.flow!.name}:${next.flow!.step}`, error);
                // Dispatch error to move to failure state
                store.dispatch({
                  type: `${next.flow!.step.toUpperCase()}.FAIL` as any,
                  error: {
                    code: "EFFECT_ERROR",
                    message: error.message || "Effect execution failed",
                    detail: error,
                    phase: next.flow!.step,
                  },
                });
              }
            });
          }
        } catch (error: any) {
          if (!signal.aborted) {
            console.error(`Sync effect error in ${next.flow.name}:${next.flow.step}`, error);
            store.dispatch({
              type: `${next.flow.step.toUpperCase()}.FAIL` as any,
              error: {
                code: "EFFECT_ERROR",
                message: error.message || "Effect execution failed",
                detail: error,
                phase: next.flow.step,
              },
            });
          }
        }
      }
    }

    // Handle auto-transitions for terminal states
    if (next.mode === "FLOW" && next.flow) {
      const flowDef = flows[next.flow.name];
      const stepDef = flowDef?.[next.flow.step];

      // Check if step should auto-transition
      if (stepDef?.next) {
        const nextStep = stepDef.next(next.flow);
        if (nextStep && nextStep !== next.flow.step) {
          // Schedule transition on next tick to avoid reducer re-entry
          setTimeout(() => {
            if (!signal.aborted) {
              store.dispatch({
                type: `${next.flow!.step.toUpperCase()}.OK` as any,
              });
            }
          }, 0);
        }
      }

      // Auto-cleanup for terminal states
      if (next.flow.step === "success" || next.flow.step === "failure") {
        setTimeout(() => {
          if (!signal.aborted) {
            // Return to idle after showing result
            const delay = next.flow!.step === "success" ? 2000 : 5000;
            setTimeout(() => {
              if (!signal.aborted) {
                store.dispatch({ type: "FLOW.CANCEL" });
              }
            }, delay);
          }
        }, 100);
      }
    }
  });

  return {
    cleanup: () => {
      currentController.abort();
      unsubscribe();
    },
    getCurrentSignal: () => currentController.signal,
  };
}

/**
 * Utility for creating cancellable async effects
 */
export function createCancellableEffect<T>(
  fn: (signal: AbortSignal) => Promise<T>
): (signal: AbortSignal) => Promise<T> {
  return async (signal: AbortSignal) => {
    if (signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const promise = fn(signal);

    // Race between the function and abortion
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
    ]);
  };
}

/**
 * Helper for creating retryable effects
 */
export function createRetryableEffect<T>(
  fn: (signal: AbortSignal, attempt: number) => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: boolean;
  } = {}
): (signal: AbortSignal) => Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = true } = options;

  return async (signal: AbortSignal) => {
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      try {
        return await fn(signal, attempt);
      } catch (error: any) {
        lastError = error;

        // Don't retry if aborted
        if (error.name === "AbortError" || signal.aborted) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxAttempts) {
          break;
        }

        // Calculate delay with optional backoff
        const currentDelay = backoff ? delay * Math.pow(2, attempt - 1) : delay;

        // Wait before retry
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(resolve, currentDelay);
          signal.addEventListener("abort", () => {
            clearTimeout(timeout);
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }
    }

    throw lastError;
  };
}

/**
 * Helper for timeout effects
 */
export function createTimeoutEffect<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): (signal: AbortSignal) => Promise<T> {
  return async (signal: AbortSignal) => {
    const timeoutController = new AbortController();
    const compositeSignal = createCompositeSignal([signal, timeoutController.signal]);

    const timeout = setTimeout(() => {
      timeoutController.abort();
    }, timeoutMs);

    try {
      return await fn(compositeSignal);
    } finally {
      clearTimeout(timeout);
    }
  };
}

/**
 * Utility to combine multiple abort signals
 */
function createCompositeSignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", () => controller.abort());
  }

  return controller.signal;
}