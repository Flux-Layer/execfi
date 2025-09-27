"use client";

import React, { useEffect, useState } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PrivyAppProvider from "@providers/privy-provider";
import { WagmiAppProvider } from "@providers/wagmi-provider"; // ⬅️ import baru
import { QCProvider } from "@providers/query-client.provider";
import { EOAProvider } from "@providers/EOAProvider";
import { Toaster } from "react-hot-toast";
import Dock from "@components/dock";
import PathFinderLoader from "@/components/loader/path-finder";
import TerminalHeader from "@/components/terminal/TerminalHeader";
import { DockProvider } from "@/context/DockContext";
import { TerminalStoreProvider } from "@/cli/hooks/useTerminalStore";

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
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
         <body>
            <PrivyAppProvider>
               <EOAProvider>
                  <DockProvider>
                     <WagmiAppProvider>
                        <QCProvider>
                           <TerminalStoreProvider>
                           {/* Intro loader overlay for first 5s with smooth fade */}
                           {introMounted && (
                              <div
                                className={`fixed inset-0 z-50 transition-[opacity,transform] duration-600 ease-out ${introVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
                              >
                                <div
                                  className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-full px-4"
                                  style={{ top: `60vh` }}
                                >
                                  <div className="mx-auto h-96 w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-800 backdrop-blur shadow-xl font-mono bg-slate-900/95">
                                    <TerminalHeader isFullscreen={false} />
                                    <div className="h-[calc(100%-3rem)] overflow-hidden">
                                      <PathFinderLoader variant="inline" caption="Initializing" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                           )}

                           {children}
                           <Dock />
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
                        </QCProvider>
                     </WagmiAppProvider>
                  </DockProvider>
               </EOAProvider>
            </PrivyAppProvider>
         </body>
      </html>
   );
}
