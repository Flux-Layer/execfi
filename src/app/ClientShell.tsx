"use client";

import React, { useEffect, useState } from "react";
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
import PathFinderLoader from "@/components/loader/path-finder";
import BaseAccountStatus from "@/components/auth/BaseAccountStatus";

interface ClientShellProps {
  children: React.ReactNode;
}

export default function ClientShell({ children }: ClientShellProps) {
  // Intro loader: show for 5s, then fade out smoothly
  const [introVisible, setIntroVisible] = useState(true);
  const [introMounted, setIntroMounted] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIntroVisible(false), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (introVisible) return;
    const t = setTimeout(() => setIntroMounted(false), 700); // match fade/scale duration
    return () => clearTimeout(t);
  }, [introVisible]);

  return (
    <PrivyAppProvider>
      <BaseAccountProvider>
        <EOAProvider>
          <DockProvider>
            <ChainSelectionProvider>
              <WagmiAppProvider>
                <QCProvider>
                  <OnboardingProvider>
                    <TerminalStoreProvider>
                  {/* Intro loader overlay for first 5s with smooth fade */}
                  {introMounted && (
                    <div
                      className={`fixed inset-0 z-50 transition-[opacity,transform] duration-600 ease-out ${introVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
                    >
                      <PathFinderLoader caption="Initializing" />
                    </div>
                  )}

                  {children}
                  <Dock />
                  <BaseAccountStatus />
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
                    </TerminalStoreProvider>
                  </OnboardingProvider>
                </QCProvider>
              </WagmiAppProvider>
            </ChainSelectionProvider>
          </DockProvider>
        </EOAProvider>
      </BaseAccountProvider>
    </PrivyAppProvider>
  );
}
