// hooks/useZeroDevSA.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { usePrivyEOA } from "./usePrivyEOA";
import {
  generatePublicClient,
  generateSignerFromEIP1193Provider,
  generateECDSAValidatorFromSigner,
  generateKernelAccount,
  generateKernelAccountClient,
} from "@/lib/aa/zero-dev";
import type { Address } from "viem";

type UseZeroDevSAReturn = {
  loading: boolean;
  error?: string;
  ownerAddress?: Address;
  saAddress?: Address;
  publicClient?: any;
  signer?: any;
  ecdsaValidator?: any;
  kernelAccount?: any;
  kernelAccountClient?: any;
  refresh: () => Promise<void>;
};

export default function useZeroDevSA(): UseZeroDevSAReturn {
  const { ready: privyReady, authenticated } = usePrivy();
  const { getEip1193, address: ownerAddress } = usePrivyEOA();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [publicClient, setPublicClient] = useState<any>();
  const [signer, setSigner] = useState<any>();
  const [ecdsaValidator, setEcdsaValidator] = useState<any>();
  const [kernelAccount, setKernelAccount] = useState<any>();
  const [kernelAccountClient, setKernelAccountClient] = useState<any>();
  const [saAddress, setSaAddress] = useState<Address>();

  const init = useCallback(async () => {
    setError(undefined);
    setLoading(true);
    try {
      if (!privyReady || !authenticated) throw new Error("Privy not ready or user not logged in");

      const eip1193 = await getEip1193();

      const pub = generatePublicClient(process.env.NEXT_PUBLIC_BUNDLER_RPC);
      setPublicClient(pub);

      const s = await generateSignerFromEIP1193Provider(eip1193);
      setSigner(s);

      const val = await generateECDSAValidatorFromSigner(s, pub);
      setEcdsaValidator(val);

      const acc = await generateKernelAccount(pub, val);
      setKernelAccount(acc);

      const client = generateKernelAccountClient({
        account: acc,
        client: pub,
        bundlerRpc: process.env.NEXT_PUBLIC_BUNDLER_RPC,
      });
      setKernelAccountClient(client);

      const addr: Address =
        (acc.getAddress ? await acc.getAddress() : acc.address) as Address;
      setSaAddress(addr);
    } catch (e: any) {
      setError(e?.message ?? "Failed to initialize ZeroDev smart account");
    } finally {
      setLoading(false);
    }
  }, [privyReady, authenticated, getEip1193]);

  useEffect(() => {
    if (privyReady && authenticated) {
      void init();
    }
  }, [privyReady, authenticated, init]);

  return {
    loading,
    error,
    ownerAddress: ownerAddress as Address | undefined,
    saAddress,
    publicClient,
    signer,
    ecdsaValidator,
    kernelAccount,
    kernelAccountClient,
    refresh: init,
  };
}

