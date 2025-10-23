"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { usePrivy, useSendTransaction } from "@privy-io/react-auth";
import useSmartWallet from "@/hooks/useSmartWallet";
import { useEOA } from "@/providers/EOAProvider";
import { useChainSelection } from "@/hooks/useChainSelection";
import { useBaseAccount } from "@/providers/base-account-context";
import type { Store } from "../state/store";
import type { AppState, Dispatch } from "../state/types";
import { createPersistedStore, createStore } from "../state/store";
import { FLOWS } from "../state/flows";
import { loadPolicy, createDefaultPolicy } from "@/lib/policy/storage";
import { useLoading } from "@/context/LoadingContext";

// Context for the terminal store
const TerminalStoreContext = createContext<{
  store: Store;
  state: AppState;
  dispatch: Dispatch;
} | null>(null);

interface TerminalStoreProviderProps {
  children: ReactNode;
}

export function TerminalStoreProvider({ children }: TerminalStoreProviderProps) {
  const { authenticated, ready, user } = usePrivy();
  const { smartWalletClient, smartAccountAddress, isReady: smartWalletReady } = useSmartWallet();
  const { selectedWallet } = useEOA();
  const { sendTransaction } = useSendTransaction();
  const { selectedChainId } = useChainSelection();
  const baseAccount = useBaseAccount();
  const { updateStepStatus, completeStep, failStep, updateStepProgress } = useLoading();

  // Track initialization state
  const [isInitialized, setIsInitialized] = useState(false);

  // Create store once and persist it
  const storeRef = useRef<Store | null>(null);
  const hasReportedInitialization = useRef(false);
  const [, forceUpdate] = useState({});

  if (!storeRef.current) {
    try {
      storeRef.current = createPersistedStore(FLOWS);
    } catch (error) {
      console.error("Failed to create store, clearing storage and retrying:", error);
      // Clear potentially corrupted storage
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem("execfi-state");
        }
      } catch {}
      // Create fresh store
      storeRef.current = createStore(FLOWS, {});
    }
  }

  const store = storeRef.current;

  useEffect(() => {
    if (hasReportedInitialization.current) {
      return;
    }

    hasReportedInitialization.current = true;
    updateStepStatus("terminal-store", "loading", 0);

    if (storeRef.current) {
      updateStepProgress("terminal-store", 20);
      updateStepProgress("terminal-store", 50);
      updateStepProgress("terminal-store", 90);
      updateStepProgress("terminal-store", 100);
      completeStep("terminal-store");
    } else {
      failStep("terminal-store", new Error("Failed to initialize terminal store"));
    }
  }, [completeStep, failStep, updateStepProgress, updateStepStatus]);

  // Subscribe to store changes to trigger provider re-renders
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      forceUpdate({}); // Force re-render when store changes
    });
    return unsubscribe;
  }, [store]);

  const state = store.getState();

  // Initialize core context - allow basic initialization even when unauthenticated
  useEffect(() => {
    if (ready && !isInitialized) {
      updateStepProgress('terminal-store', 70);

      // Load or create policy state
      const policy = loadPolicy() || createDefaultPolicy("moderate");

      // Load slippage from localStorage (default: 0.005 = 0.5%)
      let defaultSlippage = 0.005;
      try {
        const stored = typeof window !== "undefined" ? localStorage.getItem("execfi_slippage_default") : null;
        if (stored) {
          const parsed = parseFloat(stored);
          if (!isNaN(parsed) && parsed >= 0.0001 && parsed <= 0.99) {
            defaultSlippage = parsed;
          }
        }
      } catch (error) {
        console.warn("Failed to load slippage from localStorage:", error);
      }

      // Load account mode from localStorage (with smart defaults)
      let accountMode: "EOA" | "SMART_ACCOUNT" | "BASE_ACCOUNT" = "EOA";
      try {
        const storedMode = typeof window !== "undefined" ? localStorage.getItem("execfi_account_mode") : null;
        if (storedMode && ["EOA", "SMART_ACCOUNT", "BASE_ACCOUNT"].includes(storedMode)) {
          accountMode = storedMode as any;
        }
      } catch (error) {
        console.warn("Failed to load account mode from localStorage:", error);
      }

      // Auto-select appropriate mode if stored mode is not available
      // Priority: Base Account > Smart Account > EOA
      if (accountMode === "BASE_ACCOUNT" && !baseAccount.isConnected) {
        // User selected Base Account but doesn't have it - fall back
        accountMode = smartWalletReady && smartAccountAddress ? "SMART_ACCOUNT" : "EOA";
      } else if (accountMode === "SMART_ACCOUNT" && (!smartWalletReady || !smartAccountAddress)) {
        // User selected Smart Account but doesn't have it - fall back
        accountMode = baseAccount.isConnected ? "BASE_ACCOUNT" : "EOA";
      }

      const coreContext = {
        chainId: selectedChainId, // Use selected chain from chain selection context
        idempotency: new Map(),
        accountMode, // Dynamic account mode based on availability and user preference
        policy, // Add policy state
        defaultSlippage, // Add default slippage tolerance

        // Auth-specific fields only when authenticated
        ...(authenticated && user && smartWalletReady
          ? {
              userId: user.id,
              saAddress: smartAccountAddress,
              smartWalletClient: smartWalletClient,
            }
          : {
              userId: undefined,
              saAddress: undefined,
              smartWalletClient: undefined,
            }),

        // EOA transaction support - available when user has wallets
        ...(selectedWallet
          ? {
              selectedWallet,
              eoaSendTransaction: sendTransaction,
            }
          : {
              selectedWallet: undefined,
              eoaSendTransaction: undefined,
            }),

        // Base Account support - available when user has Base Account
        ...(baseAccount.isConnected
          ? {
              baseAccountClients: {
                sdk: baseAccount.sdk,
                provider: baseAccount.provider,
                address: baseAccount.baseAccountAddress as `0x${string}`,
                subAccountAddress: undefined, // Sub accounts are managed by SDK
                isConnected: true,
              },
            }
          : {
              baseAccountClients: undefined,
            }),
      };

      updateStepProgress('terminal-store', 90);

      store.dispatch({
        type: "APP.INIT",
        coreContext,
      });

      updateStepProgress('terminal-store', 100);
      completeStep('terminal-store');
      setIsInitialized(true);
    }
  }, [ready, authenticated, user, smartWalletReady, smartAccountAddress, smartWalletClient, selectedWallet, sendTransaction, selectedChainId, store, baseAccount, isInitialized, updateStepProgress, completeStep]);

  // Update context when wallet becomes available after initialization
  useEffect(() => {
    if (isInitialized && ready) {
      store.dispatch({
        type: "APP.INIT",
        coreContext: {
          ...(selectedWallet
            ? {
                selectedWallet,
                eoaSendTransaction: sendTransaction,
              }
            : {
                selectedWallet: undefined,
                eoaSendTransaction: undefined,
              }),
        },
      });
    }
  }, [selectedWallet, sendTransaction, isInitialized, ready, store]);

  // Update context when smart wallet becomes available after initialization
  useEffect(() => {
    if (isInitialized && ready && authenticated && user) {
      store.dispatch({
        type: "APP.INIT",
        coreContext: {
          ...(smartWalletReady && user
            ? {
                userId: user.id,
                saAddress: smartAccountAddress,
                smartWalletClient: smartWalletClient,
              }
            : {
                userId: undefined,
                saAddress: undefined,
                smartWalletClient: undefined,
              }),
        },
      });
    }
  }, [smartWalletReady, smartAccountAddress, smartWalletClient, user, authenticated, isInitialized, ready, store]);

  // Update context when Base Account becomes available after initialization
  useEffect(() => {
    if (isInitialized && ready) {
      store.dispatch({
        type: "APP.INIT",
        coreContext: {
          ...(baseAccount.isConnected
            ? {
                baseAccountClients: {
                  sdk: baseAccount.sdk,
                  provider: baseAccount.provider,
                  address: baseAccount.baseAccountAddress as `0x${string}`,
                  subAccountAddress: undefined,
                  isConnected: true,
                },
              }
            : {
                baseAccountClients: undefined,
              }),
        },
      });
    }
  }, [baseAccount, isInitialized, ready, store]);

  // Dispatch chain updates when selectedChainId changes
  useEffect(() => {
    if (ready && selectedChainId) {
      store.dispatch({
        type: "CHAIN.UPDATE",
        chainId: selectedChainId,
      });
    }
  }, [selectedChainId, ready, store]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (storeRef.current) {
        storeRef.current.cleanup();
      }
    };
  }, []);

  return (
    <TerminalStoreContext.Provider
      value={{
        store,
        state,
        dispatch: store.dispatch,
      }}
    >
      {children}
    </TerminalStoreContext.Provider>
  );
}

// Hook to access the terminal store
export function useTerminalStore() {
  const context = useContext(TerminalStoreContext);
  if (!context) {
    throw new Error("useTerminalStore must be used within a TerminalStoreProvider");
  }
  return context;
}

// Hook that subscribes to state changes
export function useTerminalState<T>(selector?: (state: AppState) => T): T extends undefined ? AppState : T {
  const { store } = useTerminalStore();
  const [state, setState] = useState<AppState>(store.getState());
  const selectorRef = useRef(selector);

  // Update refs
  selectorRef.current = selector;

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = store.subscribe((prev, next) => {
      setState(next); // This will trigger a re-render
    });

    return unsubscribe;
  }, [store]);

  return (selector ? selector(state) : state) as any;
}

// Specific state selectors for common use cases
export function useTerminalMode() {
  return useTerminalState((state) => state.mode);
}

export function useTerminalFlow() {
  return useTerminalState((state) => state.flow);
}

export function useTerminalInput() {
  const { dispatch } = useTerminalStore();
  const inputText = useTerminalState((state) => state.inputText);

  const setInputText = (text: string) => {
    dispatch({ type: "INPUT.CHANGE", text });
  };

  const submitInput = (text?: string) => {
    const textToSubmit = text ?? inputText;
    if (textToSubmit.trim()) {
      dispatch({ type: "INPUT.SUBMIT", text: textToSubmit });
    }
  };

  return {
    inputText,
    setInputText,
    submitInput,
  };
}

export function useTerminalChat() {
  return useTerminalState((state) => state.chatHistory);
}

export function useTerminalOverlays() {
  const { dispatch } = useTerminalStore();
  const overlays = useTerminalState((state) => state.overlays);

  const dismissOverlay = (id?: string) => {
    dispatch({ type: "OVERLAY.POP", id });
  };

  const confirmAction = () => {
    dispatch({ type: "CONFIRM.YES" });
  };

  const cancelAction = () => {
    dispatch({ type: "CONFIRM.NO" });
  };

  return {
    overlays,
    dismissOverlay,
    confirmAction,
    cancelAction,
  };
}

export function useTerminalActions() {
  const { dispatch } = useTerminalStore();

  const cancelFlow = () => {
    dispatch({ type: "FLOW.CANCEL" });
  };

  const retryFlow = () => {
    dispatch({ type: "FLOW.RETRY" });
  };

  const goBack = () => {
    dispatch({ type: "FLOW.BACK" });
  };

  const pushView = (page: Parameters<typeof dispatch>[0] extends { type: "NAV.VIEW.PUSH"; page: infer P } ? P : never) => {
    dispatch({ type: "NAV.VIEW.PUSH", page });
  };

  const popView = () => {
    dispatch({ type: "NAV.VIEW.POP" });
  };

  return {
    cancelFlow,
    retryFlow,
    goBack,
    pushView,
    popView,
  };
}

// Hook for handling authentication state
export function useTerminalAuth() {
  const { authenticated, ready, user } = usePrivy();
  const { smartWalletClient, smartAccountAddress, isReady: smartWalletReady } = useSmartWallet();

  return {
    isAuthenticated: authenticated,
    isReady: ready && smartWalletReady,
    user,
    smartWalletClient,
    smartAccountAddress,
  };
}

export function useTerminalCore() {
  const state = useTerminalState((state) => state);
  return state.core;
}
