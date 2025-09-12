"use client";

import { PrivyProvider } from "@privy-io/react-auth";

export default function PrivyAppProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || ""}
      config={{
        // Create embedded wallets for users who don't have a wallet
        embeddedWallets: {
            createOnLogin: "users-without-wallets",
        },
        appearance: { theme: "dark" },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
