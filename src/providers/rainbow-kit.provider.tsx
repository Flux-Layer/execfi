"use client";

import { WagmiProvider } from "wagmi";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, polygon, optimism, arbitrum, base } from "wagmi/chains";
import {
  metaMaskWallet,
  rabbyWallet,
  trustWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";

const customChains = [
  {
    ...mainnet,
    rpcUrls: {
      default: {
        http: ["rpc-mainnet.u2u.xyz"],
      },
      public: {
        http: ["rpc-mainnet.u2u.xyz"],
      },
    },
  },
];

const config = getDefaultConfig({
  appName: process.env.NEXT_PUBLIC_APP_NAME!,
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID!,
  wallets: [
    {
      groupName: "popular",
      wallets: [metaMaskWallet, trustWallet, rabbyWallet],
    },
  ],
  chains: [mainnet, polygon, optimism, arbitrum, base, ...customChains],
  ssr: false, // If your dApp uses server side rendering (SSR)
});

export const RKProvider = (props: React.PropsWithChildren) => {
  return (
    <WagmiProvider config={config}>
        <RainbowKitProvider>{props?.children}</RainbowKitProvider>
    </WagmiProvider>
  );
};
