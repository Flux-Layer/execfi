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
    if (eoa) {
      return {
        address: eoa.address as `0x${string}`,
        provider: await eoa.getEthereumProvider(),
      };
    }
    if (!walletsReady) throw new Error("Privy not ready");

    if (!createdOnce.current) {
      createdOnce.current = true;
      setCreating(true);
      await createWallet();
      // wait for state to update
      return new Promise<{ address: `0x${string}`; provider: any }>((resolve, reject) => {
        const t = setInterval(async () => {
          if (eoa) {
            clearInterval(t);
            resolve({
              address: eoa.address as `0x${string}`,
              provider: await eoa.getEthereumProvider(),
            });
          }
        }, 100);
        setTimeout(() => {
          clearInterval(t);
          reject(new Error("Timed out creating Privy EOA"));
        }, 15000);
      });
    }
    throw new Error("No Privy EOA and creation already attempted");
  }, [eoa, walletsReady, createWallet]);

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

