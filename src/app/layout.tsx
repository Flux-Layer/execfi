"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavDrawer } from "@components/rounded-drawer-nav";
import PrivyAppProvider from "@providers/privy-provider";
import { WagmiAppProvider } from "@providers/wagmi-provider"; // ⬅️ import baru
import { QCProvider } from "@providers/query-client.provider";
import { createConfig, http } from "wagmi";
import { base } from "viem/chains";

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
            {children}
            </QCProvider>
          </WagmiAppProvider>
        </PrivyAppProvider>
      </body>
    </html>
  );
}

