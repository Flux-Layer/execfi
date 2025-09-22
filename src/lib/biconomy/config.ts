import { base, baseSepolia } from "viem/chains";

export const SUPPORTED_CHAINS = {
  base: {
    chainId: base.id,
    name: base.name,
    rpcUrl: base.rpcUrls.default.http[0],
    nativeCurrency: base.nativeCurrency,
    blockExplorer: base.blockExplorers.default.url,
  },
  baseSepolia: {
    chainId: baseSepolia.id,
    name: baseSepolia.name,
    rpcUrl: baseSepolia.rpcUrls.default.http[0],
    nativeCurrency: baseSepolia.nativeCurrency,
    blockExplorer: baseSepolia.blockExplorers.default.url,
  },
} as const;

export const DEFAULT_CHAIN_ID = base.id;

export const getBiconomyConfig = (chainId: number) => {
  const bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_RPC;
  const paymasterApiKey = process.env.NEXT_PUBLIC_BICONOMY_PAYMASTER_API_KEY;

  if (!bundlerUrl) {
    throw new Error("NEXT_PUBLIC_BUNDLER_RPC environment variable is required");
  }

  // Paymaster is optional - for gasless transactions
  return {
    bundlerUrl,
    paymasterApiKey,
    chainId,
  };
};

export const isChainSupported = (chainId: number): boolean => {
  return Object.values(SUPPORTED_CHAINS).some(
    (chain) => chain.chainId === chainId
  );
};

export const getChainConfig = (chainId: number) => {
  const chain = Object.values(SUPPORTED_CHAINS).find(
    (c) => c.chainId === chainId
  );
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return chain;
};
