"use client";

import React from "react";
import { LoadingProvider } from "@/context/LoadingContext";
import { LoadingOrchestrator } from "@/components/loader/LoadingOrchestrator";
import { FinalPreparation } from "@/components/loader/FinalPreparation";
import PrivyAppProvider from "@providers/privy-provider";
import { BaseAccountProvider } from "@providers/base-account-context";
import { WagmiAppProvider } from "@providers/wagmi-provider";
import { QCProvider } from "@providers/query-client.provider";
import { EOAProvider } from "@providers/EOAProvider";
import { ChainSelectionProvider } from "@/hooks/useChainSelection";
import { DockProvider } from "@/context/DockContext";
import { TerminalStoreProvider } from "@/cli/hooks/useTerminalStore";
import { OnboardingProvider } from "@/context/OnboardingContext";
import { Toaster } from "react-hot-toast";
import Dock from "@components/dock";
import BaseAccountStatus from "@/components/auth/BaseAccountStatus";
import { OnboardingErrorBoundary } from "@/components/onboarding/OnboardingErrorBoundary";
import { OnboardingOrchestrator } from "@/components/onboarding/OnboardingOrchestrator";
import { MalwareIntegration } from "@/components/sunday-quest/MalwareIntegration";

interface ClientShellProps {
  children: React.ReactNode;
}

export default function ClientShell({ children }: ClientShellProps) {
  return (
    <LoadingProvider>
      <PrivyAppProvider>
        <BaseAccountProvider>
          <EOAProvider>
            <DockProvider>
              <ChainSelectionProvider>
                <WagmiAppProvider>
                  <QCProvider>
                    <OnboardingProvider>
                      <TerminalStoreProvider>
                        <FinalPreparation>
                          <LoadingOrchestrator>
                            {/* App-wide onboarding system (device-based, no wallet required) */}
                            <OnboardingErrorBoundary>
                              <OnboardingOrchestrator />
                            </OnboardingErrorBoundary>

                            {children}
                            <Dock />
                            <BaseAccountStatus />

                            {/* Sunday Quest - Malware Alert */}
                            <MalwareIntegration />
                            {/* TutorialModal moved to BombGame component for context-aware display */}
                            <Toaster
                              position="top-right"
                              toastOptions={{
                                duration: 4000,
                                style: {
                                  background: "#1f2937",
                                  color: "#f9fafb",
                                  border: "1px solid #374151",
                                },
                                success: {
                                  iconTheme: {
                                    primary: "#10b981",
                                    secondary: "#f9fafb",
                                  },
                                },
                                error: {
                                  iconTheme: {
                                    primary: "#ef4444",
                                    secondary: "#f9fafb",
                                  },
                                },
                              }}
                            />
                          </LoadingOrchestrator>
                        </FinalPreparation>
                      </TerminalStoreProvider>
                    </OnboardingProvider>
                  </QCProvider>
                </WagmiAppProvider>
              </ChainSelectionProvider>
            </DockProvider>
          </EOAProvider>
        </BaseAccountProvider>
      </PrivyAppProvider>
    </LoadingProvider>
  );
}

