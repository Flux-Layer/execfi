"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "../../wagmiConfig";

const queryClient = new QueryClient();

export function WagmiAppProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig as any}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
