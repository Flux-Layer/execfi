"use client";

import { useEffect } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "../../wagmiConfig";
import { useLoading } from "@/context/LoadingContext";

const queryClient = new QueryClient();

// Inner component to track Wagmi initialization
function WagmiLoadingTracker({ children }: { children: React.ReactNode }) {
  const { updateStepStatus, completeStep, failStep, updateStepProgress } = useLoading();

  useEffect(() => {
    updateStepStatus('wagmi-config', 'loading', 0);

    try {
      // Check if config is valid
      if (!wagmiConfig) {
        throw new Error('Wagmi config not available');
      }

      updateStepProgress('wagmi-config', 50);

      // Validate chains
      const chains = wagmiConfig.chains;
      if (chains.length === 0) {
        throw new Error('No chains configured');
      }

      updateStepProgress('wagmi-config', 100);
      completeStep('wagmi-config');

    } catch (error) {
      failStep('wagmi-config', error as Error);
    }
  }, [updateStepStatus, updateStepProgress, completeStep, failStep]);

  return <>{children}</>;
}

export function WagmiAppProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig as any}>
      <QueryClientProvider client={queryClient}>
        <WagmiLoadingTracker>{children}</WagmiLoadingTracker>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
