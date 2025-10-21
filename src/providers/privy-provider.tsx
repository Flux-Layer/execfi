"use client";

import { useEffect, useState } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import {
  base, // base mainnet
  baseSepolia, // base testnet sepolia
  mainnet, // eth mainnet
  sepolia, // eth testnet sepolia
  polygon, // polygon mainnet
  polygonAmoy, // polygon testnet amoy
  arbitrum, // arbitrum mainnet
  arbitrumSepolia, // arbitrum testnet sepolia
  optimism, // optimism mainnet
  optimismSepolia, // optimism testnet sepolia
  avalanche, // avax mainnet
  avalancheFuji, // avax testnet fuji
  bsc, // bsc mainnet
  bscTestnet, // bsc testnet
  abstract, // abstract mainnet
  abstractTestnet, // asbtract testnet
  lisk, // lisk mainnet
  liskSepolia, // listk testnet sepolia
} from "viem/chains";
import { useLoading } from "@/context/LoadingContext";

// Inner component to track Privy initialization
function PrivyLoadingTracker({ children }: { children: React.ReactNode }) {
  const { updateStepStatus, completeStep, updateStepProgress } = useLoading();
  const { ready } = usePrivy();
  const [isInitializing, setIsInitializing] = useState(true);

  // Track Privy initialization
  useEffect(() => {
    updateStepStatus('privy-init', 'loading', 0);
    setIsInitializing(true);

    // Simulate progress (Privy doesn't expose internal loading)
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + 10, 90);
      updateStepProgress('privy-init', progress);
    }, 100);

    return () => clearInterval(progressInterval);
  }, [updateStepStatus, updateStepProgress]);

  // Track when Privy is ready
  useEffect(() => {
    if (ready && isInitializing) {
      completeStep('privy-init');
      updateStepStatus('privy-ready', 'loading', 50);

      // Small delay for SmartWalletsProvider to initialize
      setTimeout(() => {
        completeStep('privy-ready');
      }, 200);

      setIsInitializing(false);
    }
  }, [ready, isInitializing, completeStep, updateStepStatus]);

  return <>{children}</>;
}

export default function PrivyAppProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || ""}
      config={{
        // Enable wallet and email as login methods
        loginMethods: ['email', 'wallet'],
        // Create embedded wallets for users who don't have a wallet
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        appearance: {
          theme: "dark",
          walletList: ['base_account'], // Base Account as primary wallet option
          showWalletLoginFirst: true, // Show wallet options first
        },
        defaultChain: base, // Set Base as default chain
        supportedChains: [
          base,
          baseSepolia,
          mainnet,
          sepolia,
          polygon,
          polygonAmoy,
          arbitrum,
          arbitrumSepolia,
          optimism,
          optimismSepolia,
          avalanche,
          avalancheFuji,
          bsc,
          bscTestnet,
          abstract,
          abstractTestnet,
          lisk,
          liskSepolia,
        ],
      }}
    >
      <PrivyLoadingTracker>
        <SmartWalletsProvider>{children}</SmartWalletsProvider>
      </PrivyLoadingTracker>
    </PrivyProvider>
  );
}
