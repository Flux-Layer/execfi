import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
