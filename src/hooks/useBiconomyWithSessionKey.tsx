"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { usePrivyEOA } from "./usePrivyEOA";
import { useSessionKey } from "./useSessionKey";
import {
  createSmartAccountClient,
  toNexusAccount,
  getMEEVersion,
  MEEVersion,
  smartSessionActions,
} from "@biconomy/abstractjs";
import { SMART_SESSIONS_ADDRESS } from "@rhinestone/module-sdk";
import type { Address } from "viem";
import { createWalletClient, custom, http } from "viem";
import { base, mainnet, polygon, arbitrum } from "viem/chains";

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

type UseBiconomyWithSessionKeyReturn = {
  loading: boolean;
  error?: string;
  ownerAddress?: Address;
  saAddress?: Address;
  client?: any;
  sessionClient?: any;
  sessionKey?: string;
  sessionKeyAddress?: Address;
  isSessionActive: boolean;
  createSession: (durationHours?: number) => Promise<void>;
  sendTxWithSession: (params: {
    to: string;
    value?: string;
    data?: string;
  }) => Promise<any>;
  sendTx: (params: {
    to: string;
    value?: string;
    data?: string;
  }) => Promise<any>;
  retry: () => Promise<void>;
  refresh: (chainId?: number) => Promise<void>;
};

export default function useBiconomyWithSessionKey(
  defaultChainId = 8453,
): UseBiconomyWithSessionKeyReturn {
  const { ready: privyReady, authenticated } = usePrivy();
  const { ensureEOA, address: ownerAddress } = usePrivyEOA();
  const {
    sessionKey,
    sessionKeyAddress,
    createSessionKey,
    isSessionActive,
    sessionGrant,
    setSessionGrant,
    sessionEnabled,
    setSessionEnabled,
  } = useSessionKey();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [client, setClient] = useState<any>();
  const [sessionClient, setSessionClient] = useState<any>();
  const [saAddress, setSaAddress] = useState<Address>();
  const [currentChainId, setCurrentChainId] = useState<number>(defaultChainId);

  const clientRef = useRef<any>(null);
  useEffect(() => {
    clientRef.current = client;
  }, [client]);

  // Add initialization tracking to prevent multiple simultaneous inits
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSessionInitializing, setIsSessionInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const initAttemptedRef = useRef(false);

  // Cache account instances to prevent repeated creation
  const nexusAccountRef = useRef<any>(null);
  const sessionAccountRef = useRef<any>(null);
  const sessionClientRef = useRef<any>(null);

  const initializeSmartAccount = useCallback(
    async (chainId: number = defaultChainId, useSession: boolean = false) => {
      // Prevent multiple simultaneous initializations
      if (useSession && isSessionInitializing) {
        console.log("Session initialization already in progress, skipping...");
        return;
      }
      if (!useSession && isInitializing) {
        console.log("Main initialization already in progress, skipping...");
        return;
      }

      setError(undefined);
      setLoading(true);

      if (useSession) {
        setIsSessionInitializing(true);
      } else {
        setIsInitializing(true);
      }

      let retryCount = 0;
      const maxRetries = 3;

      try {
        while (retryCount <= maxRetries) {
          try {
            if (!privyReady || !authenticated) {
              throw new Error("Privy not ready or user not logged in");
            }

            console.log("🔄 Calling ensureEOA...");
            const eoaRes = await ensureEOA();
            if (!eoaRes) {
              throw new Error("Failed to ensure EOA");
            }
            const { address: eoaAddr, provider } = eoaRes;
            console.log("✅ EOA ensured:", eoaAddr);

            const rpcUrl = RPC_URLS[chainId];
            if (!rpcUrl) throw new Error(`Unsupported chainId: ${chainId}`);

            const chain = CHAIN_MAP[chainId];
            if (!chain) throw new Error(`No viem chain config for ${chainId}`);

            let viemSigner;
            if (useSession && sessionKey) {
              // For session client: use session key for signing
              console.log(
                "🔑 Creating session key signer with sessionKey:",
                sessionKey.substring(0, 10) + "...",
              );
              const { privateKeyToAccount } = await import("viem/accounts");
              const sessionAccount = privateKeyToAccount(
                sessionKey as `0x${string}`,
              );
              viemSigner = sessionAccount;
              console.log(
                "🔑 Session key account created, address:",
                sessionAccount.address,
              );
            } else {
              // Use main EOA for signing
              viemSigner = createWalletClient({
                account: eoaAddr,
                chain,
                transport: custom(provider),
              });
              console.log(
                "🔑 Main EOA wallet client created, address:",
                (viemSigner.account as any)?.address,
              );
            }

            // Validate signer has an address
            const signerAddress =
              useSession && sessionKey
                ? (viemSigner as any).address // session account has direct address property
                : (viemSigner as any).account?.address; // wallet client has account.address

            if (!signerAddress) {
              throw new Error(
                `Signer missing address. Session: ${useSession}, Address: ${signerAddress}`,
              );
            }

            let nexusAccount;

            if (useSession) {
              // Check if we already have a cached session account
              if (sessionAccountRef.current) {
                nexusAccount = sessionAccountRef.current;
                console.log("🔄 Using cached session account");
              } else {
                // Create new session account with rate limit protection
                console.log("🔄 Creating new session account...");
                console.log("🔍 Session client signer details:", {
                  signerAddress: signerAddress,
                  type: "EOA (session functionality via smartSessionActions)",
                  chain: chain.name,
                });

                nexusAccount = await toNexusAccount({
                  signer: viemSigner,
                  chainConfiguration: {
                    chain,
                    transport: http(rpcUrl),
                    version: getMEEVersion(MEEVersion.V2_1_0),
                  },
                });
                sessionAccountRef.current = nexusAccount;
                console.log("🆕 Created new session account");
              }
            } else {
              // Check if we already have a cached main account
              if (nexusAccountRef.current) {
                nexusAccount = nexusAccountRef.current;
                console.log("🔄 Using cached main account");
              } else {
                // Create new main account with rate limit protection
                console.log("🔄 Creating new main account...");
                nexusAccount = await toNexusAccount({
                  signer: viemSigner,
                  chainConfiguration: {
                    chain,
                    transport: http(rpcUrl),
                    version: getMEEVersion(MEEVersion.V2_1_0),
                  },
                });
                nexusAccountRef.current = nexusAccount;
                console.log("🆕 Created new main account");
              }
            }

            const bundlerUrl = process.env.NEXT_PUBLIC_BICONOMY_BUNDLER!;

            // Create smart account client
            const saClient = createSmartAccountClient({
              account: nexusAccount,
              transport: http(bundlerUrl),
            });

            if (useSession) {
              // NO LONGER CREATING SESSION CLIENT - session creation should not call this function
              console.log(
                "❌ ERROR: initializeSmartAccount called with useSession=true",
              );
              console.log("❌ Session client creation is no longer supported");
              throw new Error(
                "Session client creation no longer supported - use main client only",
              );
            } else {
              setClient(saClient);
              setSaAddress(nexusAccount.address as Address);
              setCurrentChainId(chainId);
              setIsInitialized(true);
              console.log(
                "✅ Main smart account client created:",
                nexusAccount.address,
              );
            }

            return saClient;
          } catch (e: any) {
            console.error(
              `Smart account initialization error (attempt ${retryCount + 1}):`,
              e,
            );

            // Check if this is a rate limit error
            const isRateLimit =
              e?.message?.includes("429") ||
              e?.message?.toLowerCase().includes("rate limit") ||
              e?.message?.toLowerCase().includes("too many requests") ||
              e?.status === 429;

            if (isRateLimit && retryCount < maxRetries) {
              // Exponential backoff for rate limits: 1s, 2s, 4s
              const delay = Math.pow(2, retryCount) * 1000;
              console.log(`⏳ Rate limit detected, retrying in ${delay}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
              retryCount++;
              continue;
            }

            // If not a rate limit or we've exceeded retries, set error and throw
            setError(e?.message ?? "Failed to initialize smart account");
            throw e;
          }
        }
      } finally {
        if (useSession) {
          setIsSessionInitializing(false);
        } else {
          setIsInitializing(false);
        }
        setLoading(false);
      }
    },
    [
      privyReady,
      authenticated,
      sessionKey,
      ensureEOA,
      isSessionInitializing,
      isInitializing,
      defaultChainId,
    ],
  );

  // Session client auto-initialization removed - no longer creating separate session clients

  const createSession = useCallback(
    async (durationHours: number = 24) => {
      try {
        setLoading(true);
        setError(undefined);
        sessionAccountRef.current = null;
        sessionClientRef.current = null;
        setSessionClient(undefined);
        setSessionGrant(undefined);
        setSessionEnabled(false);

        const newSessionKey = await createSessionKey({
          validUntil: BigInt(
            Math.floor(Date.now() / 1000) + durationHours * 60 * 60,
          ),
          validAfter: BigInt(Math.floor(Date.now() / 1000)),
        });

        console.log(`✅ Session created for ${durationHours} hours`);

        // NO LONGER CREATE SEPARATE SESSION CLIENT - use main client for session transactions
        const ownerClient = clientRef.current;

        if (!ownerClient) {
          throw new Error(
            "Smart account client not ready. Initialize main client before creating sessions.",
          );
        }

        const { privateKeyToAccount } = await import("viem/accounts");
        const sessionAccount = privateKeyToAccount(
          (sessionKey || newSessionKey) as `0x${string}`,
        );

        const sessionActionsFactory = smartSessionActions();
        const ownerSessionActions = sessionActionsFactory(ownerClient);

        const permissionResponse =
          await ownerSessionActions.grantPermissionPersonalSign([
            {
              redeemer: sessionAccount.address,
              chainId: BigInt(currentChainId),
              permitERC4337Paymaster: true,
              actions: [
                {
                  actionTarget: "0x0000000000000000000000000000000000000000", // Zero address = wildcard for any target
                  actionTargetSelector: "0x00000000", // Zero selector = wildcard for any function
                  actionPolicies: [], // No specific policies = allow all
                },
              ],
            },
          ]);

        setSessionGrant(permissionResponse);
        setSessionEnabled(false);

        console.log("✅ Session permissions granted successfully");
      } catch (error) {
        console.error("Failed to create session:", error);
        setError("Failed to create session");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [
      createSessionKey,
      currentChainId,
      sessionKey,
      setSessionGrant,
      setSessionEnabled,
      setSessionClient,
    ],
  );

  const sendTxWithSession = useCallback(
    async (request: { to: string; value?: string; data?: string }) => {
      if (!sessionKey) {
        throw new Error("No active session key");
      }

      if (!client) {
        throw new Error(
          "Smart account client not initialized. Initialize main client before using sessions.",
        );
      }

      if (!sessionGrant || sessionGrant.length === 0) {
        throw new Error(
          "Session permission not granted. Run 'create session' again to authorize the session key.",
        );
      }

      const getSessionAccount = async () => {
        if (sessionAccountRef.current) {
          return sessionAccountRef.current;
        }

        const chain = CHAIN_MAP[currentChainId];
        const rpcUrl = RPC_URLS[currentChainId];
        if (!chain || !rpcUrl) {
          throw new Error(`Unsupported chainId for session account: ${currentChainId}`);
        }

        if (!saAddress) {
          throw new Error(
            "Smart account address not set. Initialize main smart account before using sessions.",
          );
        }

        const { privateKeyToAccount } = await import("viem/accounts");
        const sessionSignerAccount = privateKeyToAccount(sessionKey as `0x${string}`);

        const sessionNexusAccount = await toNexusAccount({
          signer: sessionSignerAccount,
          chainConfiguration: {
            chain,
            transport: http(rpcUrl),
            version: getMEEVersion(MEEVersion.V2_1_0),
          },
          accountAddress: saAddress as Address,
        });

        sessionAccountRef.current = sessionNexusAccount;
        console.log("🔍 Derived session smart account from session key:", {
          sessionKeyAddress: sessionSignerAccount.address,
          sessionSmartAccount: sessionNexusAccount.address,
        });
        return sessionNexusAccount;
      };

      const getSessionClient = async () => {
        if (sessionClientRef.current) {
          return sessionClientRef.current;
        }

        const sessionAccount = await getSessionAccount();
        const bundlerUrl = process.env.NEXT_PUBLIC_BICONOMY_BUNDLER;
        if (!bundlerUrl) {
          throw new Error("Biconomy bundler URL not configured");
        }

        const sessionSaClient = createSmartAccountClient({
          account: sessionAccount,
          transport: http(bundlerUrl),
        });

        sessionClientRef.current = sessionSaClient;
        setSessionClient(sessionSaClient);
        return sessionSaClient;
      };

      const maxRetries = 3;
      let lastError: any;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const sessionExecuteClient = await getSessionClient();
          const sessionAccount = await getSessionAccount();

          // Add small delay between retries to allow nonce to update
          if (attempt > 1) {
            const delayMs = Math.min(1000 * (attempt - 1), 3000); // 1s, 2s, 3s max
            console.log(
              `⏱️ Waiting ${delayMs}ms before session retry (attempt ${attempt}/${maxRetries})...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }

          // Fetch fresh nonce before session transaction
          let currentNonce;
          try {
            console.log("🔍 [Session] Fetching current nonce...");
            if (typeof sessionAccount.getNonce === "function") {
              currentNonce = await sessionAccount.getNonce({
                moduleAddress: SMART_SESSIONS_ADDRESS,
              });
              console.log(
                "✅ [Session] Current nonce from session account:",
                currentNonce?.toString(),
              );
            }
          } catch (nonceError) {
            console.warn("⚠️ [Session] Failed to fetch nonce:", nonceError);
          }

          console.log(
            "🔑 Sending transaction with session key (usePermission flow)...",
          );

          const sessionActionsFactory = smartSessionActions();
          const sessionActions = sessionActionsFactory(sessionExecuteClient);
          const mode = sessionEnabled ? "USE" : "ENABLE_AND_USE";

          console.log("🔎 Comparing smart account addresses for session vs owner:", {
            sessionSmartAccount: sessionAccount.address,
            ownerSmartAccount: saAddress,
          });

          console.log("🔍 SESSION MODE DEBUG:", {
            sessionEnabled,
            mode,
            sessionGrantExists: !!sessionGrant,
            sessionGrantLength: sessionGrant?.length || 0,
          });

          if (sessionGrant?.length) {
            console.log("🔍 Session grant payload sample:", sessionGrant[0]);
          }

          console.log("🚀 CALLING usePermission with:", {
            mode,
            sessionDetailsArrayLength: sessionGrant?.length,
            callsCount: 1,
            callDetails: {
              to: request.to,
              value: request?.value,
              data: request?.data,
            },
          });

          const userOpHash = await sessionActions.usePermission({
            account: sessionAccount,
            sessionDetailsArray: sessionGrant,
            mode,
            calls: [
              {
                to: request.to as Address,
                data: (request?.data ?? "0x") as any,
                value: request?.value ? BigInt(request.value) : 0n,
              },
            ],
          });

          console.log("✅ usePermission returned userOpHash:", userOpHash);

          const receipt = await sessionExecuteClient.waitForUserOperationReceipt({
            hash: userOpHash,
          });
          const transactionHash =
            receipt.receipt?.transactionHash || userOpHash;

          if (!transactionHash) {
            throw new Error(
              "Transaction failed: No transaction hash in receipt",
            );
          }

          if (!sessionEnabled) {
            setSessionEnabled(true);
          }

          console.log(
            `✅ Session tx sent on chain ${currentChainId}:`,
            transactionHash,
          );
          return transactionHash;
        } catch (err: any) {
          lastError = err;

          // Enhanced nonce conflict detection for various error patterns
          const errorMessage = err?.message || "";
          const errorCode = err?.code || "";
          const errorResponse = err?.response?.data || "";
          const errorStatus = err?.status || err?.response?.status;

          console.log("🔍 [Session] Analyzing error for nonce conflict:", {
            errorMessage,
            errorCode,
            errorResponse,
            errorStatus,
          });

          const isNonceConflict =
            // Direct nonce error codes
            errorCode === "NONCE_EXPIRED" ||
            errorCode === "NONCE_CONFLICT" ||
            // Message patterns for nonce conflicts
            errorMessage.toLowerCase().includes("nonce") ||
            errorMessage.includes("Transaction nonce conflict") ||
            // HTTP response patterns
            (errorStatus === 400 &&
              (errorMessage.includes("nonce") ||
                errorResponse.includes("nonce") ||
                errorMessage.includes("conflict")));

          console.log("Error message: ", errorMessage);
          console.log("Error response: ", errorResponse);
          console.log("Error code: ", errorCode);
          console.log("Error status: ", errorStatus);

          // If it's a nonce conflict and we haven't exhausted retries, continue to next attempt
          if (isNonceConflict && attempt < maxRetries) {
            console.warn(
              `🔄 Nonce conflict detected in session tx, retrying (${attempt}/${maxRetries})...`,
            );
            continue;
          }

          // If it's the last attempt or not a retryable error, break out of loop
          break;
        }
      }

      // If we get here, all retries failed
      console.error("Session tx error after all retries:", lastError);
      throw lastError;
    },
    [
      sessionKey,
      client,
      currentChainId,
      sessionGrant,
      sessionEnabled,
      setSessionEnabled,
      saAddress,
      setSessionClient,
    ],
  );

  const sendTx = useCallback(
    async (request: { to: string; value?: string; data?: string }) => {
      if (!client) throw new Error("Client not initialized");

      const maxRetries = 3;
      let lastError: any;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Add small delay between retries to allow nonce to update
          if (attempt > 1) {
            const delayMs = Math.min(1000 * (attempt - 1), 3000); // 1s, 2s, 3s max
            console.log(
              `⏱️ Waiting ${delayMs}ms before retry (attempt ${attempt}/${maxRetries})...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }

          // Fetch fresh nonce before regular transaction
          let currentNonce;
          try {
            console.log("🔍 [Regular] Fetching current nonce...");
            if (typeof client.getNonce === "function") {
              currentNonce = await client.getNonce();
              console.log(
                "✅ [Regular] Current nonce:",
                currentNonce?.toString(),
              );
            } else if (typeof client.account?.getNonce === "function") {
              currentNonce = await client.account.getNonce();
              console.log(
                "✅ [Regular] Current nonce from account:",
                currentNonce?.toString(),
              );
            }
          } catch (nonceError) {
            console.warn("⚠️ [Regular] Failed to fetch nonce:", nonceError);
          }

          const hash = await client.sendUserOperation({
            calls: [
              {
                to: request.to,
                data: request?.data ?? "0x",
                value: request?.value ? BigInt(request.value) : BigInt(0),
              },
            ],
          });

          console.log("📧 User operation hash:", hash);

          const receipt = await client.waitForUserOperationReceipt({ hash });
          const transactionHash = receipt.receipt?.transactionHash || hash;

          if (!transactionHash) {
            throw new Error(
              "Transaction failed: No transaction hash in receipt",
            );
          }

          console.log(
            `✅ Tx sent on chain ${currentChainId}:`,
            transactionHash,
          );
          return transactionHash;
        } catch (err: any) {
          lastError = err;

          // Enhanced nonce conflict detection for various error patterns
          const errorMessage = err?.message || "";
          const errorCode = err?.code || "";
          const errorResponse = err?.response?.data || "";
          const errorStatus = err?.status || err?.response?.status;

          console.log("🔍 [Regular] Analyzing error for nonce conflict:", {
            errorMessage,
            errorCode,
            errorResponse,
            errorStatus,
          });

          const isNonceConflict =
            // Direct nonce error codes
            errorCode === "NONCE_EXPIRED" ||
            errorCode === "NONCE_CONFLICT" ||
            // Message patterns for nonce conflicts
            errorMessage.toLowerCase().includes("nonce") ||
            errorMessage.includes("Transaction nonce conflict") ||
            // HTTP response patterns
            (errorStatus === 400 &&
              (errorMessage.includes("nonce") ||
                errorResponse.includes("nonce") ||
                errorMessage.includes("conflict"))) ||
            // Bundler-specific patterns
            errorMessage.includes("UserOperation failed during simulation");

          // If it's a nonce conflict and we haven't exhausted retries, continue to next attempt
          if (isNonceConflict && attempt < maxRetries) {
            console.warn(
              `🔄 Nonce conflict detected in sendTx, retrying (${attempt}/${maxRetries})...`,
            );
            continue;
          }

          // If it's the last attempt or not a retryable error, break out of loop
          break;
        }
      }

      // If we get here, all retries failed
      console.error("Tx error after all retries:", lastError);
      throw lastError;
    },
    [client, currentChainId],
  );

  // Initialize main smart account when conditions are met
  useEffect(() => {
    // console.log("🔍 Smart account initialization check:", {
    //   privyReady,
    //   authenticated,
    //   client: !!client,
    //   isInitializing,
    //   isInitialized,
    //   initAttempted: initAttemptedRef.current,
    //   ownerAddress,
    // });

    if (
      privyReady &&
      authenticated &&
      !client &&
      !isInitializing &&
      !isInitialized &&
      !initAttemptedRef.current
    ) {
      console.log("✅ All conditions met - Initializing main smart account...");
      initAttemptedRef.current = true;

      initializeSmartAccount(defaultChainId, false).catch((error) => {
        console.error("❌ Failed to initialize smart account:", error);
        // Reset initAttempted flag on error to allow retry
        initAttemptedRef.current = false;
      });
    }
  }, [
    privyReady,
    authenticated,
    client,
    isInitializing,
    isInitialized,
    ownerAddress,
    defaultChainId,
    initializeSmartAccount,
  ]);

  // Cleanup function to prevent memory leaks
  useEffect(() => {
    return () => {
      nexusAccountRef.current = null;
      sessionAccountRef.current = null;
      sessionClientRef.current = null;
    };
  }, []);

  // Manual retry function
  const retry = useCallback(async () => {
    console.log("🔄 Manual retry requested...");
    initAttemptedRef.current = false;
    setError(undefined);
    setIsInitialized(false);
    nexusAccountRef.current = null;
    sessionAccountRef.current = null;
    sessionClientRef.current = null;
    setSessionClient(undefined);
    setSessionGrant(undefined);
    setSessionEnabled(false);
    await initializeSmartAccount(defaultChainId, false);
  }, [
    defaultChainId,
    initializeSmartAccount,
    setSessionGrant,
    setSessionEnabled,
    setSessionClient,
  ]);

  return {
    loading,
    error,
    ownerAddress: ownerAddress as Address | undefined,
    saAddress,
    client,
    sessionClient,
    sessionKey,
    sessionKeyAddress,
    isSessionActive,
    createSession,
    sendTxWithSession,
    sendTx,
    retry, // Add retry function
    refresh: async (chainId?: number) => {
      await initializeSmartAccount(chainId || defaultChainId, false);
    },
  };
}
