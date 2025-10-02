import { usePrivy } from "@privy-io/react-auth";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useEOA } from "@/hooks/useEOA";
import useSessionSigner from "./useSessionSigner";

interface SmartWalletAccount {
  address: string;
  type: "smart_wallet";
  // Add other properties as needed based on Privy's LinkedAccount type
}

export default function useSmartWallet() {
  const { user, ready } = usePrivy();
  const { client: smartWalletClient } = useSmartWallets();
  const { selectedWalletIndex, setSelectedWalletIndex } = useEOA();

  const [selectedSmartWalletIndex, setSelectedSmartWalletIndex] = useState(0);

  // Get all Smart Wallets for the user
  const smartWallets = useMemo(() => {
    if (!user || !ready) return [];

    const smartWallets = user?.linkedAccounts?.filter(
      (account) => account?.type === "smart_wallet",
    ) as SmartWalletAccount[];

    return smartWallets || [];
  }, [user, ready]);

  // Get currently selected Smart Wallet
  const selectedSmartWallet = useMemo(() => {
    return smartWallets[selectedSmartWalletIndex] || null;
  }, [smartWallets, selectedSmartWalletIndex]);

  // Persist selected Smart Wallet index to localStorage
  useEffect(() => {
    const savedIndex = localStorage.getItem("selectedSmartWalletIndex");
    if (savedIndex && !isNaN(parseInt(savedIndex))) {
      const index = parseInt(savedIndex);
      if (index < smartWallets.length) {
        setSelectedSmartWalletIndex(index);
      }
    }
  }, [smartWallets.length]);

  // Save selected Smart Wallet index to localStorage
  useEffect(() => {
    localStorage.setItem(
      "selectedSmartWalletIndex",
      selectedSmartWalletIndex.toString(),
    );
  }, [selectedSmartWalletIndex]);

  // Reset selected index if it's out of bounds
  useEffect(() => {
    if (
      selectedSmartWalletIndex >= smartWallets.length &&
      smartWallets.length > 0
    ) {
      setSelectedSmartWalletIndex(0);
    }
  }, [smartWallets.length, selectedSmartWalletIndex]);

  // Sync Smart Wallet selection with EOA selection
  // When EOA changes, try to find a corresponding Smart Wallet
  useEffect(() => {
    // For now, we'll keep Smart Wallet selection independent
    // In a more sophisticated implementation, you might want to:
    // 1. Match Smart Wallet to EOA based on some relationship
    // 2. Auto-select the Smart Wallet that corresponds to the selected EOA
    // 3. This would require understanding Privy's internal linking mechanism
  }, [selectedWalletIndex]);

  // Function to update selected Smart Wallet index with bounds checking
  const handleSetSelectedSmartWalletIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < smartWallets.length) {
        setSelectedSmartWalletIndex(index);

        // Optional: Sync EOA selection based on Smart Wallet
        // This would require understanding the relationship mapping
        // For now, we'll keep them independent but synchronized through UI
      } else {
        console.error("Invalid Smart Wallet index selected", {
          index,
          availableSmartWallets: smartWallets.length,
        });
      }
    },
    [smartWallets.length],
  );

  // Format address helper
  const formatSmartWalletAddress = useCallback(
    (address: string | undefined) => {
      if (!address) return "";
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    },
    [],
  );

  // Copy Smart Wallet address helper
  const copySmartWalletAddress = useCallback(
    async (address: string): Promise<boolean> => {
      if (!address) return false;

      try {
        await navigator.clipboard.writeText(address);
        return true;
      } catch (err) {
        console.error("Failed to copy Smart Wallet address:", err);
        return false;
      }
    },
    [],
  );

  useSessionSigner();

  return {
    // Multi-Smart Wallet support
    smartWallets,
    selectedSmartWallet,
    selectedSmartWalletIndex,
    setSelectedSmartWalletIndex: handleSetSelectedSmartWalletIndex,

    // Current Smart Wallet (for backward compatibility)
    smartWallet: selectedSmartWallet,
    smartWalletClient,
    smartAccountAddress: selectedSmartWallet?.address as
      | `0x${string}`
      | undefined,

    // Status
    isReady: ready && !!selectedSmartWallet && !!smartWalletClient,
    hasMultipleSmartWallets: smartWallets.length > 1,

    // Utilities
    formatSmartWalletAddress,
    copySmartWalletAddress,
  };
}
