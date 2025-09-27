"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PrivyAppProvider from "@providers/privy-provider";
import { WagmiAppProvider } from "@providers/wagmi-provider"; // ⬅️ import baru
import { QCProvider } from "@providers/query-client.provider";
import { EOAProvider } from "@providers/EOAProvider";
import { Toaster } from "react-hot-toast";
import Dock from "@components/dock";

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
               <EOAProvider>
                  <WagmiAppProvider>
                     <QCProvider>
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
                     </QCProvider>
                  </WagmiAppProvider>
               </EOAProvider>
            </PrivyAppProvider>
         </body>
      </html>
   );
}
