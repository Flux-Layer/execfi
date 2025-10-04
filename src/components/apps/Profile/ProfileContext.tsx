"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import useSmartWallet from "@/hooks/useSmartWallet";
import { useEOA } from "@/providers/EOAProvider";
import { useChainSelection } from "@/hooks/useChainSelection";
import { useTerminalStore } from "@/cli/hooks/useTerminalStore";
import type { PolicyState } from "@/lib/policy/types";
import { savePolicy, createDefaultPolicy } from "@/lib/policy/storage";
import type { AppState } from "@/cli/state/types";

export interface ProfileActivityEntry {
  id: string;
  status: "success" | "pending" | "failed";
  description: string;
  timestamp: number;
  chainId?: number;
  txHash?: `0x${string}`;
  explorerUrl?: string;
}

export interface ProfileContextValue {
  loading: boolean;
  authenticated: boolean;
  identity: {
    userId?: string;
    email?: string;
    imageUrl?: string;
  };
  smartAccount: {
    address?: `0x${string}`;
    ready: boolean;
  };
  eoaWallets: ReturnType<typeof useEOA>["wallets"];
  selectedEoa?: ReturnType<typeof useEOA>["selectedWallet"];
  selectEoa: ReturnType<typeof useEOA>["setSelectedWalletIndex"];
  copyAddress: ReturnType<typeof useEOA>["copyAddress"];
  copiedAddress: ReturnType<typeof useEOA>["copiedAddress"];
  formatAddress: ReturnType<typeof useEOA>["formatAddress"];
  chain: {
    id: number;
    name: string;
  };
  policy: PolicyState;
  updatePolicy: (next: PolicyState) => void;
  resetPolicy: (preset?: Parameters<typeof createDefaultPolicy>[0]) => void;
  activity: ProfileActivityEntry[];
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

function deriveActivity(state: AppState): ProfileActivityEntry[] {
  const history = [...state.chatHistory].reverse();
  const entries: ProfileActivityEntry[] = [];

  for (let index = 0; index < history.length; index++) {
    const item = history[index];
    if (typeof item.content !== "string") continue;
    const text = item.content.trim();
    if (!text) continue;

    const status = inferStatus(text, item.role);
    const description = text.split("\n")[0];
    const txHashMatch = text.match(/0x[a-fA-F0-9]{64}/);

    entries.push({
      id: `${item.timestamp}-${index}`,
      status,
      description,
      timestamp: item.timestamp,
      chainId: state.core.chainId,
      txHash: txHashMatch ? (txHashMatch[0] as `0x${string}`) : undefined,
    });

    if (entries.length >= 12) break;
  }

  return entries;
}

function inferStatus(text: string, role: "user" | "assistant"): ProfileActivityEntry["status"] {
  const normalized = text.toLowerCase();
  if (role === "user") return "pending";
  if (normalized.includes("success") || normalized.includes("🎉")) return "success";
  if (normalized.includes("failed") || normalized.includes("error") || normalized.includes("❌") || normalized.includes("💥")) {
    return "failed";
  }
  return "pending";
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const privy = usePrivy();
  const { smartAccountAddress, isReady: smartWalletReady } = useSmartWallet();
  const eoa = useEOA();
  const { selectedChain, selectedChainId } = useChainSelection();
  const { state, dispatch } = useTerminalStore();

  const handlePolicyUpdate = useCallback(
    (next: PolicyState) => {
      dispatch({ type: "POLICY.UPDATE", policy: next });
      savePolicy(next);
    },
    [dispatch],
  );

  const handlePolicyReset = useCallback(
    (preset?: Parameters<typeof createDefaultPolicy>[0]) => {
      const next = createDefaultPolicy(preset);
      dispatch({ type: "POLICY.RESET", preset });
      savePolicy(next);
    },
    [dispatch],
  );

  const value = useMemo<ProfileContextValue>(() => {
    const identity = {
      userId: privy.user?.id,
      email: privy.user?.email?.address,
      imageUrl: undefined, // TODO: Update when Privy User type includes profile picture
    };

    const policy = state.core.policy;

    const activity = deriveActivity(state);

    return {
      loading: !privy.ready,
      authenticated: !!privy.authenticated,
      identity,
      smartAccount: {
        address: smartAccountAddress,
        ready: !!smartWalletReady,
      },
      eoaWallets: eoa.wallets,
      selectedEoa: eoa.selectedWallet ?? undefined,
      selectEoa: eoa.setSelectedWalletIndex,
      copyAddress: eoa.copyAddress,
      copiedAddress: eoa.copiedAddress,
      formatAddress: eoa.formatAddress,
      chain: {
        id: selectedChainId,
        name: selectedChain.name,
      },
      policy,
      updatePolicy: handlePolicyUpdate,
      resetPolicy: handlePolicyReset,
      activity,
    };
  }, [
    privy,
    smartAccountAddress,
    smartWalletReady,
    eoa,
    selectedChain,
    selectedChainId,
    state,
    handlePolicyUpdate,
    handlePolicyReset,
  ]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfileContext() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("Profile components must be used within ProfileProvider");
  }
  return ctx;
}
