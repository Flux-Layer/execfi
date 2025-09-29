"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  DEFAULT_CHAIN_ID,
  getChainConfig,
  getSupportedChains,
  isChainSupported,
  resolveChain,
  type ChainConfig,
} from "@/lib/chains/registry";
import { useEOA } from "./useEOA";

interface ChainSelectionContextType {
  // Current chain state
  selectedChainId: number;
  selectedChain: ChainConfig;

  // Available chains
  availableChains: ChainConfig[];
  supportedChainIds: number[];

  // Chain switching
  switchChain: (chainId: number) => Promise<boolean>;
  switchChainByName: (chainName: string) => Promise<boolean>;

  // Validation
  isSupported: (chainId: number) => boolean;

  // Status
  isLoading: boolean;
  lastSwitchError: string | null;
}

const ChainSelectionContext = createContext<
  ChainSelectionContextType | undefined
>(undefined);

interface ChainSelectionProviderProps {
  children: ReactNode;
  defaultChainId?: number;
}

const STORAGE_KEY = "execfi-selected-chain-id";

export function ChainSelectionProvider({
  children,
  defaultChainId = DEFAULT_CHAIN_ID,
}: ChainSelectionProviderProps) {
  const [selectedChainId, setSelectedChainId] =
    useState<number>(defaultChainId);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSwitchError, setLastSwitchError] = useState<string | null>(null);

  const { selectedWallet } = useEOA();

  useEffect(() => {
    console.log({ selectedWallet });
  }, [selectedWallet]);

  // synchronize selected chain with privy selected chain
  useEffect(() => {
    selectedWallet?.switchChain?.(selectedChainId);
  }, [selectedChainId]);

  // Load saved chain preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const chainId = parseInt(saved, 10);
        if (!isNaN(chainId) && isChainSupported(chainId)) {
          setSelectedChainId(chainId);
          console.log(
            `🔗 Loaded saved chain: ${getChainConfig(chainId)?.name} (${chainId})`,
          );
        } else {
          // Clean up invalid saved value
          localStorage.removeItem(STORAGE_KEY);
          console.log(`🔗 Defaulting to Base (${DEFAULT_CHAIN_ID})`);
        }
      } else {
        console.log(
          `🔗 No saved chain, defaulting to Base (${DEFAULT_CHAIN_ID})`,
        );
      }
    } catch (error) {
      console.warn("Failed to load chain preference:", error);
      setSelectedChainId(DEFAULT_CHAIN_ID);
    }
  }, [selectedWallet]);

  // Save chain preference to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, selectedChainId.toString());
    } catch (error) {
      console.warn("Failed to save chain preference:", error);
    }
  }, [selectedChainId]);

  // Get current chain config
  const selectedChain =
    getChainConfig(selectedChainId) || getChainConfig(DEFAULT_CHAIN_ID)!;

  // Get all available chains
  const availableChains = getSupportedChains();
  const supportedChainIds = availableChains.map((chain) => chain.id);

  // Listen for chain switch requests from CLI commands
  useEffect(() => {
    const handleChainSwitchRequest = async (event: CustomEvent) => {
      const { chainId, resolve } = event.detail;

      setIsLoading(true);
      setLastSwitchError(null);

      try {
        // Validate chain is supported
        if (!isChainSupported(chainId)) {
          const supportedNames = availableChains
            .map((c) => `${c.name} (${c.id})`)
            .join(", ");
          throw new Error(
            `Chain ${chainId} is not supported. Supported chains: ${supportedNames}`,
          );
        }

        // Check if already on this chain
        if (selectedChainId === chainId) {
          console.log(
            `Already on ${getChainConfig(chainId)?.name} (${chainId})`,
          );
          resolve(true);
          return;
        }

        const newChain = getChainConfig(chainId)!;
        const currentChain = getChainConfig(selectedChainId)!;

        console.log(
          `🔄 Switching chain: ${currentChain.name} (${selectedChainId}) → ${newChain.name} (${chainId})`,
        );

        // Update selected chain
        setSelectedChainId(chainId);

        console.log(`✅ Chain switched to ${newChain.name} (${chainId})`);
        resolve(true);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown error during chain switch";
        console.error("❌ Chain switch failed:", errorMessage);
        setLastSwitchError(errorMessage);
        resolve(false);
      } finally {
        setIsLoading(false);
      }
    };

    window.addEventListener(
      "chain-switch-request",
      handleChainSwitchRequest as any,
    );

    return () => {
      window.removeEventListener(
        "chain-switch-request",
        handleChainSwitchRequest as any,
      );
    };
  }, [selectedChainId, availableChains, selectedWallet]);

  // Switch chain by ID with validation
  const switchChain = useCallback(
    async (chainId: number): Promise<boolean> => {
      setIsLoading(true);
      setLastSwitchError(null);

      try {
        // Validate chain is supported
        if (!isChainSupported(chainId)) {
          const supportedNames = availableChains
            .map((c) => `${c.name} (${c.id})`)
            .join(", ");
          throw new Error(
            `Chain ${chainId} is not supported. Supported chains: ${supportedNames}`,
          );
        }

        // Check if already on this chain
        if (selectedChainId === chainId) {
          console.log(`Already on ${selectedChain.name} (${chainId})`);
          return true;
        }

        const newChain = getChainConfig(chainId)!;

        console.log(
          `🔄 Switching chain: ${selectedChain.name} (${selectedChainId}) → ${newChain.name} (${chainId})`,
        );

        // Update selected chain
        setSelectedChainId(chainId);

        console.log(`✅ Chain switched to ${newChain.name} (${chainId})`);
        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown error during chain switch";
        console.error("❌ Chain switch failed:", errorMessage);
        setLastSwitchError(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [selectedChainId, selectedChain, availableChains, selectedWallet],
  );

  // Switch chain by name with resolution
  const switchChainByName = useCallback(
    async (chainName: string): Promise<boolean> => {
      try {
        const chainConfig = resolveChain(chainName);
        return await switchChain(chainConfig.id);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown error resolving chain";
        setLastSwitchError(errorMessage);
        console.error("❌ Chain resolution failed:", errorMessage);
        return false;
      }
    },
    [switchChain],
  );

  const contextValue: ChainSelectionContextType = {
    selectedChainId,
    selectedChain,
    availableChains,
    supportedChainIds,
    switchChain,
    switchChainByName,
    isSupported: isChainSupported,
    isLoading,
    lastSwitchError,
  };

  return (
    <ChainSelectionContext.Provider value={contextValue}>
      {children}
    </ChainSelectionContext.Provider>
  );
}

/**
 * Hook to access chain selection functionality
 */
export function useChainSelection() {
  const context = useContext(ChainSelectionContext);
  if (context === undefined) {
    throw new Error(
      "useChainSelection must be used within a ChainSelectionProvider",
    );
  }
  return context;
}

/**
 * Hook to get current chain config only (lightweight)
 */
export function useCurrentChain() {
  const { selectedChain } = useChainSelection();
  return selectedChain;
}

/**
 * Hook to get chain switching functions only
 */
export function useChainSwitch() {
  const { switchChain, switchChainByName, isLoading, lastSwitchError } =
    useChainSelection();
  return { switchChain, switchChainByName, isLoading, lastSwitchError };
}
