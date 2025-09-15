"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavDrawer } from "@components/rounded-drawer-nav";
import PrivyAppProvider from "@providers/privy-provider";
import { usePrivyEOA } from "@hooks/usePrivyEOA";
import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { WagmiAppProvider } from "@providers/wagmi-provider"; // ⬅️ import baru
import { QCProvider } from "@providers/query-client.provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <PrivyAppProvider>
          <WagmiAppProvider>
            <QCProvider>
              <NavDrawer />
              <EOAInitializer />
              {children}
            </QCProvider>
          </WagmiAppProvider>
        </PrivyAppProvider>
      </body>
    </html>
  );
}

function EOAInitializer() {
  const { ensureEOA } = usePrivyEOA();
  const { authenticated, ready } = usePrivy();

  useEffect(() => {
    if (authenticated && !ready && ensureEOA) ensureEOA();
  }, [ready, ensureEOA, authenticated]);

  return null;
}
