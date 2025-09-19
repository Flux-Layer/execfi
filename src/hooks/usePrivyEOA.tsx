"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallets, useCreateWallet, usePrivy } from "@privy-io/react-auth";

type UsePrivyEOA = {
  ready: boolean;
  address?: `0x${string}`;
  getEip1193: () => Promise<any>;
  ensureEOA: () => Promise<{ address: `0x${string}`; provider: any }>;
  creating: boolean;
  error?: string;
};

export function usePrivyEOA(): UsePrivyEOA {
  const { wallets, ready: walletsReady } = useWallets();
  const { ready: privyReady, authenticated } = usePrivy();

  // Use refs to always get current values
  const walletsRef = useRef(wallets);
  const walletsReadyRef = useRef(walletsReady);

  // Update refs whenever values change
  useEffect(() => {
    walletsRef.current = wallets;
    walletsReadyRef.current = walletsReady;
  }, [wallets, walletsReady]);

  // Only log when there are meaningful changes
  useEffect(() => {
    if (privyReady && authenticated) {
      console.log("🔍 usePrivyEOA - privyReady:", privyReady, "authenticated:", authenticated, "walletsReady:", walletsReady, "wallets:", wallets?.map(w => ({ type: w.walletClientType, address: w.address })));
    }
  }, [privyReady, authenticated, walletsReady, wallets?.length]);

  const [eoa, setEoa] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const createdOnce = useRef(false);

  const { createWallet } = useCreateWallet({
    onSuccess: ({ wallet }) => {
      setEoa(wallet);
      setCreating(false);
    },
    onError: (err: any) => {
      setError(err?.message ?? "Failed to create wallet");
      setCreating(false);
    },
  });

  useEffect(() => {
    if (!walletsReady) return;
    const privy = wallets?.find((w) => w.walletClientType === "privy") ?? null;
    setEoa(privy);
  }, [walletsReady, wallets]);

  const getEip1193 = useCallback(async () => {
    if (!eoa) throw new Error("Privy EOA not available yet");
    return eoa.getEthereumProvider();
  }, [eoa]);

  const ensureEOA = useCallback(async () => {
    // Always get current values from refs
    const currentWallets = walletsRef.current;
    const currentWalletsReady = walletsReadyRef.current;

    console.log("🔍 ensureEOA called - privyReady:", privyReady, "authenticated:", authenticated, "walletsReady:", currentWalletsReady, "wallets:", currentWallets?.map(w => ({ type: w.walletClientType, address: w.address })));

    // Check Privy is ready and user is authenticated first
    if (!privyReady || !authenticated) {
      throw new Error("Privy not ready or user not authenticated");
    }

    // 1) If we already have a cached wallet, return it immediately
    if (eoa) {
      console.log("✅ Using cached EOA:", eoa.address);
      return {
        address: eoa.address as `0x${string}`,
        provider: await eoa.getEthereumProvider(),
      };
    }

    // 2) Check if we already have wallets available (use current refs)
    if (currentWallets && currentWallets.length > 0) {
      const embeddedWallet = currentWallets.find((w) => w.walletClientType === "privy");
      if (embeddedWallet) {
        console.log("✅ Found existing embedded wallet immediately:", embeddedWallet.address);
        setEoa(embeddedWallet);
        return {
          address: embeddedWallet.address as `0x${string}`,
          provider: await embeddedWallet.getEthereumProvider(),
        };
      }
    }

    // 3) If no wallets immediately available, wait with polling
    const timeout = 15000; // 15 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Get current values from refs on each iteration
      const currentWalletsInLoop = walletsRef.current;
      const currentWalletsReadyInLoop = walletsReadyRef.current;

      console.log(`⏳ Checking wallets - ready: ${currentWalletsReadyInLoop}, count: ${currentWalletsInLoop?.length}, wallets:`, currentWalletsInLoop?.map(w => ({ type: w.walletClientType, address: w.address })));

      // Look for existing embedded wallet
      if (currentWalletsInLoop && currentWalletsInLoop.length > 0) {
        const embeddedWallet = currentWalletsInLoop.find((w) => w.walletClientType === "privy");
        if (embeddedWallet) {
          console.log("✅ Found existing embedded wallet:", embeddedWallet.address);
          setEoa(embeddedWallet);
          return {
            address: embeddedWallet.address as `0x${string}`,
            provider: await embeddedWallet.getEthereumProvider(),
          };
        }
      }

      // If walletsReady is true, we can proceed with creation logic
      if (currentWalletsReadyInLoop) {
        console.log("📝 Wallets are ready, checking if we need to create one...");
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 4) If we still don't have wallets after waiting, try to create one
    const finalCurrentWallets = walletsRef.current;
    if ((!finalCurrentWallets || finalCurrentWallets.length === 0 || !finalCurrentWallets.find(w => w.walletClientType === "privy")) && !createdOnce.current) {
      console.log("🔄 No embedded wallet found, attempting to create one...");
      createdOnce.current = true;
      setCreating(true);

      try {
        await createWallet();

        // Wait for wallet creation
        const createTimeout = 15000;
        const createStartTime = Date.now();

        while (Date.now() - createStartTime < createTimeout) {
          if (eoa) {
            console.log("✅ Wallet created successfully:", eoa.address);
            setCreating(false);
            return {
              address: eoa.address as `0x${string}`,
              provider: await eoa.getEthereumProvider(),
            };
          }

          const freshWalletCurrent = walletsRef.current?.find((w) => w.walletClientType === "privy");
          if (freshWalletCurrent) {
            console.log("✅ Fresh wallet found:", freshWalletCurrent.address);
            setEoa(freshWalletCurrent);
            setCreating(false);
            return {
              address: freshWalletCurrent.address as `0x${string}`,
              provider: await freshWalletCurrent.getEthereumProvider(),
            };
          }

          await new Promise(resolve => setTimeout(resolve, 300));
        }

        throw new Error("Wallet creation timed out");
      } catch (error: any) {
        console.error("❌ Wallet creation failed:", error);

        // If error indicates wallet already exists, try harder to find it
        if (error.message.includes("already has an embedded wallet") || error.message.includes("User already has")) {
          console.log("🔍 Wallet already exists, searching more thoroughly...");

          // Force refresh wallets state and search again
          const finalTimeout = 5000;
          const finalStartTime = Date.now();

          while (Date.now() - finalStartTime < finalTimeout) {
            const existingWallet = walletsRef.current?.find((w) => w.walletClientType === "privy");
            if (existingWallet) {
              console.log("✅ Found existing wallet after error:", existingWallet.address);
              setEoa(existingWallet);
              setCreating(false);
              return {
                address: existingWallet.address as `0x${string}`,
                provider: await existingWallet.getEthereumProvider(),
              };
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        setCreating(false);
        createdOnce.current = false; // Reset for retry
        throw error;
      }
    }

    // 5) If we get here, something went wrong
    throw new Error("Unable to ensure EOA wallet - no wallet found and creation failed or was not attempted");
  }, [privyReady, authenticated, eoa, createWallet]);

  return useMemo(
    () => ({
      ready: privyReady && authenticated, // Use Privy's overall ready state
      address: eoa?.address as `0x${string}` | undefined,
      getEip1193,
      ensureEOA,
      creating,
      error,
    }),
    [privyReady, authenticated, eoa?.address, getEip1193, ensureEOA, creating, error]
  );
}
