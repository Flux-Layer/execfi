"use client";

import { useEffect, useState, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { usePrivyEOA } from "./usePrivyEOA";
import { createSmartAccountClient, toNexusAccount, getMEEVersion, MEEVersion } from "@biconomy/abstractjs";
import type { Address } from "viem";
import { createWalletClient, custom, http } from "viem";
import { base, mainnet, polygon, arbitrum } from "viem/chains";
import { getEmbeddedConnectedWallet } from "@privy-io/react-auth";

// Global transaction queue to prevent nonce conflicts across hooks
const hookTransactionQueue = new Map<string, Promise<any>>();

/**
 * Queue transactions for a specific account to prevent nonce conflicts
 */
async function queueAccountTransaction<T>(accountAddress: string, operation: () => Promise<T>): Promise<T> {
  const existingPromise = hookTransactionQueue.get(accountAddress);

  const newPromise = existingPromise
    ? existingPromise.catch(() => {}).then(() => operation())
    : operation();

  hookTransactionQueue.set(accountAddress, newPromise);

  try {
    const result = await newPromise;
    if (hookTransactionQueue.get(accountAddress) === newPromise) {
      hookTransactionQueue.delete(accountAddress);
    }
    return result;
  } catch (error) {
    if (hookTransactionQueue.get(accountAddress) === newPromise) {
      hookTransactionQueue.delete(accountAddress);
    }
    throw error;
  }
}

const RPC_URLS: Record<number, string> = {
  8453: `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  1: `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  42161: `https://arb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  137: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
};

const CHAIN_MAP: Record<number, any> = {
  8453: base,
  1: mainnet,
  137: polygon,
  42161: arbitrum,
};

type UseBiconomySAReturn = {
  loading: boolean;
  error?: string;
  ownerAddress?: Address;
  saAddress?: Address;
  client?: any;
  sendTx: (params: {
    to: string;
    value?: string;
    data?: string;
  }) => Promise<any>;
  refresh: (chainId?: number) => Promise<void>;
};

export default function useBiconomySA(
  defaultChainId = 8453
): UseBiconomySAReturn {
  const { ready: privyReady, authenticated } = usePrivy();
  const { ensureEOA, address: ownerAddress } = usePrivyEOA();
  const {wallets} = useWallets()

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [client, setClient] = useState<any>();
  const [saAddress, setSaAddress] = useState<Address>();
  const [currentChainId, setCurrentChainId] = useState<number>(defaultChainId);

  const init = useCallback(
    async (chainId: number = defaultChainId) => {
      setError(undefined);
      setLoading(true);

      if (privyReady && ownerAddress) {
        try {
          if (!privyReady || !authenticated) {
            throw new Error("Privy not ready or user not logged in");
          }

          const eoaRes = await ensureEOA();
          if (!eoaRes) {
            throw new Error("Failed to ensure EOA");
          }
          const { address: eoaAddr, provider } = eoaRes;

          console.log({eoaAddr, provider})

          console.log({ eoaRes });

          const rpcUrl = RPC_URLS[chainId];
          if (!rpcUrl) throw new Error(`Unsupported chainId: ${chainId}`);
          console.log({ rpcUrl });

          const chain = CHAIN_MAP[chainId];
          if (!chain) throw new Error(`No viem chain config for ${chainId}`);
          console.log({ chain });

          const viemSigner = createWalletClient({
            account: eoaAddr,
            chain,
            transport: custom(provider),

          });


          






          // Create Nexus account using the new AbstractJS pattern
          const nexusAccount = await toNexusAccount({
            signer: viemSigner,
            chainConfiguration: {
              chain,
              transport: http(rpcUrl),
              version: getMEEVersion(MEEVersion.V2_1_0) // Use the latest MEE version
            }
            // Nexus handles validation modules automatically
          });


          const bundlerUrl = process.env.NEXT_PUBLIC_BICONOMY_BUNDLER!;
          const paymasterUrl = process.env.NEXT_PUBLIC_BICONOMY_PAYMASTER;

          console.log({ bundlerUrl, paymasterUrl, chainId, rpcUrl });

          // Create smart account client with Nexus account
          const saClient = createSmartAccountClient({
            account: nexusAccount,
            transport: http(bundlerUrl),
            // Paymaster configuration can be added here if needed
          });

          console.log("✅ Nexus account created:", nexusAccount.address)

          setClient(saClient);
          setCurrentChainId(chainId);

          // Use the Nexus account address directly
          const addr = nexusAccount.address;
          console.log({ addr });
          setSaAddress(addr as Address);
        } catch (e: any) {
          console.error("Biconomy init error:", e);
          setError(e?.message ?? "Failed to initialize Biconomy smart account");
        } finally {
          setLoading(false);
        }
      }
    },
    [privyReady, authenticated, defaultChainId, ownerAddress] // ✅ ensureEOA tidak masuk deps
  );

  const sendTx = useCallback(
    async (request: { to: string; value?: string; data?: string }) => {
      if (!client) throw new Error("Client not initialized");
      if (!saAddress) throw new Error("Smart account address not available");

      // Queue transaction to prevent nonce conflicts
      return queueAccountTransaction(saAddress, async () => {
        const maxRetries = 3;
        let lastError: any;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Add small delay between retries to allow nonce to update
          if (attempt > 1) {
            const delayMs = Math.min(1000 * (attempt - 1), 3000); // 1s, 2s, 3s max
            console.log(`⏱️ Waiting ${delayMs}ms before retry (attempt ${attempt}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }

          // Fetch fresh nonce before each attempt
          let currentNonce;
          try {
            console.log("🔍 [useBiconomySA] Fetching current nonce...");
            if (typeof client.getNonce === 'function') {
              currentNonce = await client.getNonce();
              console.log("✅ [useBiconomySA] Current nonce:", currentNonce?.toString());
            } else if (typeof client.account?.getNonce === 'function') {
              currentNonce = await client.account.getNonce();
              console.log("✅ [useBiconomySA] Current nonce from account:", currentNonce?.toString());
            }
          } catch (nonceError) {
            console.warn("⚠️ [useBiconomySA] Failed to fetch nonce:", nonceError);
          }

          // Use the correct AbstractJS pattern with sendUserOperation
          const hash = await client.sendUserOperation({
            calls: [{
              to: request.to,
              data: request?.data ?? "0x",
              value: request?.value ? BigInt(request.value) : BigInt(0),
            }]
          });

          console.log("📧 User operation hash:", hash);

          // Wait for the user operation receipt using AbstractJS pattern
          const receipt = await client.waitForUserOperationReceipt({ hash });

          console.log("📋 User operation receipt:", receipt);

          // Extract transaction hash from receipt
          const transactionHash = receipt.receipt?.transactionHash || hash;

          if (!transactionHash) {
            throw new Error("Transaction failed: No transaction hash in receipt");
          }

          console.log(`✅ Tx sent on chain ${currentChainId}:`, transactionHash);
          return transactionHash;

        } catch (err: any) {
          lastError = err;

          // Enhanced nonce conflict detection for various error patterns
          const errorMessage = err?.message || "";
          const errorCode = err?.code || "";
          const errorResponse = err?.response?.data || "";
          const errorStatus = err?.status || err?.response?.status;

          console.log("🔍 [useBiconomySA] Analyzing error for nonce conflict:", {
            errorMessage,
            errorCode,
            errorResponse,
            errorStatus
          });

          const isNonceConflict =
            // Direct nonce error codes
            errorCode === "NONCE_EXPIRED" ||
            errorCode === "NONCE_CONFLICT" ||
            // Message patterns for nonce conflicts
            errorMessage.toLowerCase().includes("nonce") ||
            errorMessage.includes("Transaction nonce conflict") ||
            // HTTP response patterns
            (errorStatus === 400 && (
              errorMessage.includes("nonce") ||
              errorResponse.includes("nonce") ||
              errorMessage.includes("conflict")
            )) ||
            // Bundler-specific patterns
            errorMessage.includes("UserOperation failed during simulation");

          // If it's a nonce conflict and we haven't exhausted retries, continue to next attempt
          if (isNonceConflict && attempt < maxRetries) {
            console.warn(`🔄 Nonce conflict detected in sendTx, retrying (${attempt}/${maxRetries})...`);
            continue;
          }

          // If it's the last attempt or not a retryable error, break out of loop
          break;
        }
      }

      // If we get here, all retries failed
      console.error("sendTx error after all retries:", lastError);
      throw lastError;
      }); // Close queueAccountTransaction
    },
    [client, currentChainId, saAddress]
  );

  useEffect(() => {
    if (privyReady && authenticated) {
      void init(defaultChainId);
    }
  }, [privyReady, authenticated, init, defaultChainId]);

  return {
    loading,
    error,
    ownerAddress: ownerAddress as Address | undefined,
    saAddress,
    client,
    sendTx,
    refresh: init,
  };
}
