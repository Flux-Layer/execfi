import type { Metadata, Viewport } from "next";
import type { ReactNode, CSSProperties } from "react";
import "./globals.css";
import ClientShell from "./ClientShell";
import { seoDefaults } from "@/lib/seo";

// Force dynamic rendering for client-side app with Privy
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

// Viewport configuration for mobile
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

const fontVariables = {
  "--font-geist-sans": "Inter, system-ui, sans-serif",
  "--font-geist-mono": "Menlo, Consolas, monospace",
} as Record<string, string>;

export const metadata: Metadata = {
  metadataBase: new URL(seoDefaults.siteUrl),
  title: {
    default: seoDefaults.title,
    template: seoDefaults.titleTemplate,
  },
  description: seoDefaults.description,
  keywords: seoDefaults.keywords,
  alternates: {
    canonical: "/",
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ExecFi',
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: seoDefaults.siteUrl,
    title: seoDefaults.title,
    description: seoDefaults.description,
    siteName: seoDefaults.siteName,
    images: [
      {
        url: seoDefaults.image,
        width: 1200,
        height: 630,
        alt: `${seoDefaults.siteName} preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: seoDefaults.twitterHandle,
    creator: seoDefaults.twitterHandle,
    title: seoDefaults.title,
    description: seoDefaults.description,
    images: [seoDefaults.image],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/execfi.favicon.svg",
    apple: "/execfi.favicon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={fontVariables as unknown as CSSProperties}>
      <head>
        {/* Preconnect to critical domains for faster loading */}
        <link rel="preconnect" href="https://auth.privy.io" />
        <link rel="preconnect" href="https://base-mainnet.g.alchemy.com" />

        {/* DNS prefetch for other resources */}
        <link rel="dns-prefetch" href="https://api.execfi.com" />
      </head>
      <body>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
