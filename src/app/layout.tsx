import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import { RKProvider } from "../providers/rainbow-kit.provider";
import { QCProvider } from "../providers/query-client.provider";
import { NavDrawer } from "../components/rounded-drawer-nav";

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
      <QCProvider>

      <RKProvider>
      <NavDrawer/>
      {children}

      </RKProvider>
      </QCProvider>
      </body>
    </html>
  );
}
