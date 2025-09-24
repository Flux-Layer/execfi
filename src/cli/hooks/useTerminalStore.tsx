"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { usePrivy } from "@privy-io/react-auth";
import useSmartWallet from "@/hooks/useSmartWallet";
import type { Store } from "../state/store";
import type { AppState, Dispatch } from "../state/types";
import { createPersistedStore, createStore } from "../state/store";
import { FLOWS } from "../state/flows";

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

  // Create store once and persist it
  const storeRef = useRef<Store | null>(null);
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

  // Subscribe to store changes to trigger provider re-renders
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      forceUpdate({}); // Force re-render when store changes
    });
    return unsubscribe;
  }, [store]);

  const state = store.getState();

  // Initialize core context when auth is ready
  useEffect(() => {
    if (ready && authenticated && user && smartWalletReady) {
      store.dispatch({
        type: "APP.INIT",
        coreContext: {
          userId: user.id,
          chainId: 8453, // Base mainnet default
          saAddress: smartAccountAddress,
          smartWalletClient: smartWalletClient,
          idempotency: new Map(),
        },
      });
    }
  }, [ready, authenticated, user, smartWalletReady, smartAccountAddress, smartWalletClient, store]);

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