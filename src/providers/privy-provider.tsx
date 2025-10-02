"use client";

import { PrivyProvider } from "@privy-io/react-auth";
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
        // Create embedded wallets for users who don't have a wallet
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        appearance: { theme: "dark" },
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
      <SmartWalletsProvider>{children}</SmartWalletsProvider>
    </PrivyProvider>
  );
}
