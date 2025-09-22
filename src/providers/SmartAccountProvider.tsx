"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { BiconomySmartAccountV2 } from "@biconomy/account";
import toast from "react-hot-toast";
import { useEOA } from "./EOAProvider";
import {
  SmartAccountContextType,
  TransactionData,
  SmartAccountError,
} from "@/lib/biconomy/types";
import {
  createBiconomySmartAccount,
  getSmartAccountAddress,
  checkDeploymentStatus,
  deploySmartAccount,
  formatSmartAccountError,
} from "@/lib/biconomy/utils";
import { DEFAULT_CHAIN_ID, isChainSupported } from "@/lib/biconomy/config";

const SmartAccountContext = createContext<SmartAccountContextType | undefined>(
  undefined
);

interface SmartAccountProviderProps {
  children: ReactNode;
}

export function SmartAccountProvider({ children }: SmartAccountProviderProps) {
  const { selectedWallet } = useEOA();

  // Smart Account State
  const [smartAccount, setSmartAccount] =
    useState<BiconomySmartAccountV2 | null>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(
    null
  );

  // Deployment State
  const [isDeployed, setIsDeployed] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);

  // Transaction State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Configuration State
  const [currentChainId, setCurrentChainId] =
    useState<number>(DEFAULT_CHAIN_ID);
  const [isPaymasterEnabled, setIsPaymasterEnabled] = useState(true);

  // Error handling with toast
  const handleError = useCallback((error: any, operation: string) => {
    const errorMessage = formatSmartAccountError(error);
    setError(errorMessage);
    toast.error(`${operation}: ${errorMessage}`);
    console.error(`Smart Account ${operation} Error:`, error);

    // Clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  }, []);

  // Success notification
  const handleSuccess = useCallback((message: string) => {
    toast.success(message);
  }, []);

  // Create smart account when wallet changes
  const createSmartAccount = useCallback(async () => {
    if (!selectedWallet) {
      setSmartAccount(null);
      setSmartAccountAddress(null);
      setIsDeployed(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Create smart account
      console.log("Creating smart account with parameters... ", {
        selectedWallet,
        currentChainId,
        isPaymasterEnabled,
      });
      const newSmartAccount = await createBiconomySmartAccount(
        selectedWallet,
        currentChainId,
        isPaymasterEnabled
      );

      // Get address (deterministic, works before deployment)
      const address = await getSmartAccountAddress(newSmartAccount);

      // Check deployment status
      const deployed = await checkDeploymentStatus(newSmartAccount);

      setSmartAccount(newSmartAccount);
      setSmartAccountAddress(address);
      setIsDeployed(deployed);

      console.log("Smart Account created:", {
        address,
        deployed,
        chainId: currentChainId,
        paymaster: isPaymasterEnabled,
      });
    } catch (error: any) {
      handleError(error, "Smart Account Creation");
      setSmartAccount(null);
      setSmartAccountAddress(null);
      setIsDeployed(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedWallet, currentChainId, isPaymasterEnabled, handleError]);

  // Deploy smart account manually
  const deploy = useCallback(async () => {
    if (!smartAccount) {
      const errorMessage = "No smart account available for deployment";
      handleError(new Error(errorMessage), "Deployment");
      return;
    }

    if (isDeployed) {
      toast("Smart account is already deployed", { icon: "ℹ️" });
      return;
    }

    try {
      setIsDeploying(true);
      setError(null);

      const txHash = await deploySmartAccount(smartAccount);
      setIsDeployed(true);

      handleSuccess(
        `Smart account deployed successfully! TX: ${txHash.slice(0, 10)}...`
      );
      console.log("Smart Account deployed:", {
        txHash,
        address: smartAccountAddress,
      });
    } catch (error: any) {
      handleError(error, "Deployment");
    } finally {
      setIsDeploying(false);
    }
  }, [
    smartAccount,
    isDeployed,
    smartAccountAddress,
    handleError,
    handleSuccess,
  ]);

  // Send single transaction
  const sendTransaction = useCallback(
    async (txData: TransactionData): Promise<string> => {
      if (!smartAccount) {
        throw new SmartAccountError("No smart account available");
      }

      try {
        setIsLoading(true);
        setError(null);

        // Ensure transaction has required fields
        const transaction = {
          to: txData.to,
          value: txData.value || 0,
          data: txData.data || "0x",
        };

        // Send transaction through smart account
        const userOpResponse = await smartAccount.sendTransaction(transaction);
        const userOpResult = await userOpResponse.wait();

        const txHash = userOpResult.receipt.transactionHash;
        handleSuccess(
          `Transaction sent successfully! TX: ${txHash.slice(0, 10)}...`
        );

        return txHash;
      } catch (error: any) {
        handleError(error, "Transaction");
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [smartAccount, handleError, handleSuccess]
  );

  // Send batch transaction
  const sendBatchTransaction = useCallback(
    async (txDataArray: TransactionData[]): Promise<string> => {
      if (!smartAccount) {
        throw new SmartAccountError("No smart account available");
      }

      try {
        setIsLoading(true);
        setError(null);

        // Ensure all transactions have required fields
        const transactions = txDataArray.map((txData) => ({
          to: txData.to,
          value: txData.value || 0,
          data: txData.data || "0x",
        }));

        // Send batch transaction through smart account
        const userOpResponse = await smartAccount.sendTransaction(transactions);
        const userOpResult = await userOpResponse.wait();

        const txHash = userOpResult.receipt.transactionHash;
        handleSuccess(
          `Batch transaction sent successfully! TX: ${txHash.slice(0, 10)}...`
        );

        return txHash;
      } catch (error: any) {
        handleError(error, "Batch Transaction");
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [smartAccount, handleError, handleSuccess]
  );

  // Switch chain
  const switchChain = useCallback(
    async (chainId: number) => {
      if (!isChainSupported(chainId)) {
        const errorMessage = `Unsupported chain ID: ${chainId}`;
        handleError(new Error(errorMessage), "Chain Switch");
        return;
      }

      if (chainId === currentChainId) {
        return;
      }

      setCurrentChainId(chainId);
      // Smart account will be recreated via useEffect
    },
    [currentChainId, handleError]
  );

  // Paymaster controls
  const enablePaymaster = useCallback(() => {
    setIsPaymasterEnabled(true);
    toast.success("Paymaster enabled - gasless transactions available");
  }, []);

  const disablePaymaster = useCallback(() => {
    setIsPaymasterEnabled(false);
    toast("Paymaster disabled - gas fees required", { icon: "ℹ️" });
  }, []);

  // Create smart account when dependencies change
  useEffect(() => {
    createSmartAccount();
  }, [createSmartAccount]);

  const contextValue: SmartAccountContextType = {
    // Smart Account Instance
    smartAccount,
    smartAccountAddress,

    // Deployment Status
    isDeployed,
    isDeploying,
    deploy,

    // Transaction Methods
    sendTransaction,
    sendBatchTransaction,

    // State Management
    isLoading,
    error,

    // Configuration
    currentChainId,
    switchChain,

    // Paymaster
    isPaymasterEnabled,
    enablePaymaster,
    disablePaymaster,
  };

  return (
    <SmartAccountContext.Provider value={contextValue}>
      {children}
    </SmartAccountContext.Provider>
  );
}

export function useSmartAccount(): SmartAccountContextType {
  const context = useContext(SmartAccountContext);
  if (context === undefined) {
    throw new Error(
      "useSmartAccount must be used within a SmartAccountProvider"
    );
  }
  return context;
}
