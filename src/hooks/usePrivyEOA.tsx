"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallets, useCreateWallet } from "@privy-io/react-auth";

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
    // 1) Must be ready before doing anything


    // 2) If we already have a wallet, return it
    if (eoa) {
      return {
        address: eoa.address as `0x${string}`,
        provider: await eoa.getEthereumProvider(),
      };
    }

    // 3) Prevent duplicate creates
    if (createdOnce.current) {
      throw new Error("No Privy EOA and creation already attempted");
    }
    createdOnce.current = true;
    setCreating(true);

    // 4) Kick off creation
    await createWallet();

    // 5) Wait (with timeout) for Privy to surface the new wallet
    const timeoutAt = Date.now() + 20_000; // 20s
    // If you have eoaRef.current, prefer it over `eoa` below:
    while (Date.now() < timeoutAt) {
      // Re-check every 150ms
      // const w = eoaRef.current ?? eoa; // <— best if you maintain a ref
      const w = eoa;

      console.log({w})
      if (w) {
        setCreating(false);
        const provider1 = await w.getEthereumProvider()
        const provider2 = await w?.getEthersProvider?.()
        console.log({provider1, provider2})
        return {
          address: w.address as `0x${string}`,
          provider: await w.getEthereumProvider(),
        };
      }
      // small delay

      await new Promise((r) => setTimeout(r, 150));
    }

    setCreating(false);
    throw new Error("Timed out creating Privy EOA");
  }, [walletsReady, eoa, createWallet]);

  return useMemo(
    () => ({
      ready: walletsReady,
      address: eoa?.address as `0x${string}` | undefined,
      getEip1193,
      ensureEOA,
      creating,
      error,
    }),
    [walletsReady, eoa?.address, getEip1193, ensureEOA, creating, error]
  );
}
