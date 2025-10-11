"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useWallets } from "@privy-io/react-auth";
import { ConnectedWallet } from "@privy-io/react-auth";

interface EOAContextType {
  // Wallet Management
  wallets: ConnectedWallet[];
  privyWallets: ConnectedWallet[];
  selectedWallet: ConnectedWallet | null;
  selectedWalletIndex: number;
  setSelectedWalletIndex: (index: number) => void;

  // Utilities
  formatAddress: (address: string) => string;
  copyAddress: (address: string) => Promise<void>;
  copiedAddress: boolean;

  // State
  isLoading: boolean;
  error: string | null;
}

const EOAContext = createContext<EOAContextType | undefined>(undefined);

interface EOAProviderProps {
  children: ReactNode;
}

export function EOAProvider({ children }: EOAProviderProps) {
  const { wallets } = useWallets();
  const [selectedWalletIndex, setSelectedWalletIndex] = useState(0);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter to get only Privy EOA wallets
  const privyWallets = React.useMemo(() => {
    if (!wallets || wallets.length === 0) return [];
    console.log({wallets})
    return wallets.filter((wallet) => wallet.walletClientType === "privy");
  }, [wallets]);

  // Get selected wallet
  const selectedWallet = React.useMemo(() => {
    return privyWallets[selectedWalletIndex] || null;
  }, [privyWallets, selectedWalletIndex]);
  useEffect(() => {
    console.log({ selectedWallet });
  }, [selectedWallet]);

  // Persist selected wallet index to localStorage
  useEffect(() => {
    const savedIndex = localStorage.getItem("selectedWalletIndex");
    if (savedIndex && !isNaN(parseInt(savedIndex))) {
      const index = parseInt(savedIndex);
      if (index < privyWallets.length) {
        setSelectedWalletIndex(index);
      }
    }
  }, [privyWallets.length]);

  // Save selected wallet index to localStorage
  useEffect(() => {
    localStorage.setItem("selectedWalletIndex", selectedWalletIndex.toString());
  }, [selectedWalletIndex]);

  // Reset selected index if it's out of bounds
  useEffect(() => {
    if (selectedWalletIndex >= privyWallets.length && privyWallets.length > 0) {
      setSelectedWalletIndex(0);
    }
  }, [privyWallets.length, selectedWalletIndex]);

  // Utility functions
  const formatAddress = React.useCallback((address: string): string => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, []);

  const copyAddress = React.useCallback(
    async (address: string): Promise<void> => {
      try {
        setIsLoading(true);
        await navigator.clipboard.writeText(address);
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
      } catch (err) {
        const errorMessage = "Failed to copy address to clipboard";
        setError(errorMessage);

        // Toast error to user (you can integrate with your preferred toast library)
        console.error(errorMessage, err);

        // Clear error after showing
        setTimeout(() => setError(null), 5000);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Update selected wallet index with bounds checking
  const handleSetSelectedWalletIndex = React.useCallback(
    (index: number) => {
      if (index >= 0 && index < privyWallets.length) {
        setSelectedWalletIndex(index);
      } else {
        const errorMessage = "Invalid wallet index selected";
        setError(errorMessage);
        console.error(errorMessage, {
          index,
          availableWallets: privyWallets.length,
        });
        setTimeout(() => setError(null), 5000);
      }
    },
    [privyWallets.length],
  );

  const contextValue: EOAContextType = {
    // Wallet Management
    wallets,
    privyWallets,
    selectedWallet,
    selectedWalletIndex,
    setSelectedWalletIndex: handleSetSelectedWalletIndex,

    // Utilities
    formatAddress,
    copyAddress,
    copiedAddress,

    // State
    isLoading,
    error,
  };

  return (
    <EOAContext.Provider value={contextValue}>{children}</EOAContext.Provider>
  );
}

export function useEOA(): EOAContextType {
  const context = useContext(EOAContext);
  if (context === undefined) {
    throw new Error("useEOA must be used within an EOAProvider");
  }
  return context;
}
