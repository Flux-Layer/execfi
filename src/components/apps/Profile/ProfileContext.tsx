"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import useSmartWallet from "@/hooks/useSmartWallet";
import { useEOA } from "@/providers/EOAProvider";
import { useChainSelection } from "@/hooks/useChainSelection";
import { useTerminalStore } from "@/cli/hooks/useTerminalStore";
import { useBaseAccount } from "@/providers/base-account-context";
import type { PolicyState } from "@/lib/policy/types";
import { savePolicy, createDefaultPolicy } from "@/lib/policy/storage";
import type { AppState, AccountMode } from "@/cli/state/types";
import { useOnChainActivity } from "@/hooks/useOnChainActivity";
import { mergeActivitySources, convertChatHistoryToActivity } from "@/lib/activity/aggregator";
import type { OnChainActivity } from "@/lib/activity/types";

// Legacy interface for backward compatibility
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
  baseAccount: {
    address?: string | null;
    isConnected: boolean;
    promptSetup: () => void;
  };
  accountMode: AccountMode;
  setAccountMode: (mode: AccountMode) => void;
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
  activity: OnChainActivity[];
  activityLoading: boolean;
  activityError: Error | null;
  refreshActivity: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const privy = usePrivy();
  const { smartAccountAddress, isReady: smartWalletReady } = useSmartWallet();
  const eoa = useEOA();
  const baseAccount = useBaseAccount();
  const { selectedChain, selectedChainId } = useChainSelection();
  const { state, dispatch } = useTerminalStore();

  // Fetch on-chain activity for selected EOA wallet
  const selectedEoaAddress = eoa.selectedWallet?.address as `0x${string}` | undefined;
  const {
    activities: onChainActivities,
    loading: activityLoading,
    error: activityError,
    refetch: refreshActivity,
  } = useOnChainActivity({
    address: selectedEoaAddress, // Use selected EOA address, not smart account
    chainIds: [selectedChainId],
    enabled: !!selectedEoaAddress,
    limit: 50,
  });

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

  const handleAccountModeChange = useCallback(
    (mode: AccountMode) => {
      dispatch({ type: "ACCOUNT_MODE.UPDATE", accountMode: mode });
      console.log(`🔄 Account mode switched to: ${mode}`);
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

    // Merge on-chain activity with chat history
    const chatActivities = smartAccountAddress 
      ? convertChatHistoryToActivity(state, smartAccountAddress)
      : [];
    const activity = mergeActivitySources(onChainActivities, chatActivities);

    return {
      loading: !privy.ready,
      authenticated: !!privy.authenticated,
      identity,
      smartAccount: {
        address: smartAccountAddress,
        ready: !!smartWalletReady,
      },
      baseAccount: {
        address: baseAccount.baseAccountAddress,
        isConnected: baseAccount.isConnected,
        promptSetup: baseAccount.promptSetup,
      },
      accountMode: state.core.accountMode || "EOA",
      setAccountMode: handleAccountModeChange,
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
      activityLoading,
      activityError,
      refreshActivity,
    };
  }, [
    privy,
    smartAccountAddress,
    smartWalletReady,
    baseAccount,
    eoa,
    selectedChain,
    selectedChainId,
    state,
    handlePolicyUpdate,
    handlePolicyReset,
    handleAccountModeChange,
    onChainActivities,
    activityLoading,
    activityError,
    refreshActivity,
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
