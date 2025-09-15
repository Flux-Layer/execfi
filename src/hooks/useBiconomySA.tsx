"use client";

import { useEffect, useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { usePrivyEOA } from "./usePrivyEOA";
import { createSmartAccountClient } from "@biconomy/account";
import type { Address } from "viem";
import { createWalletClient, custom } from "viem";
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

          const saClient = await createSmartAccountClient({
            signer: viemSigner,
            bundlerUrl: process.env.NEXT_PUBLIC_BICONOMY_BUNDLER!,
            rpcUrl,
            chainId,
          });

          setClient(saClient);
          setCurrentChainId(chainId);

          const addr = await saClient.getAddress();
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

      try {
        const txHash = await client.sendTransaction({
          to: request.to,
          data: request?.data ?? "0x",
          value: request?.value ? BigInt(request.value) : BigInt(0),
        });
        console.log(`✅ Tx sent on chain ${currentChainId}:`, txHash);
        return txHash;
      } catch (err) {
        console.error("Tx error:", err);
        throw err;
      }
    },
    [client, currentChainId]
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
