import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QCProvider } from "../providers/query-client.provider";
import { NavDrawer } from "../components/rounded-drawer-nav";
import PrivyAppProvider from "../providers/privy-provider";
import { WagmiProvider } from "@privy-io/wagmi";
import { wagmiConfig } from "../../wagmiConfig";

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
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PrivyAppProvider>
          <QCProvider>
              <NavDrawer />
              {children}
          </QCProvider>
        </PrivyAppProvider>
      </body>
    </html>
  );
}
