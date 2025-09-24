import { usePrivy } from "@privy-io/react-auth";
import { useMemo } from "react";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";

export default function useSmartWallet() {
   const { user, ready } = usePrivy();
   const { client: smartWalletClient } = useSmartWallets();

   const smartWallets = useMemo(() => {
      if (!user || !ready) return [];

      const smartWallets = user?.linkedAccounts?.filter(
         (account) => account?.type === "smart_wallet",
      );
      return smartWallets;
   }, [user, ready]);

   const smartWallet = useMemo(() => {
      if (!user || !ready) return null;

      const smartWallet = user?.linkedAccounts?.find(
         (account) => account?.type === "smart_wallet",
      );
      return smartWallet;
   }, [user, ready]);

   return {
      smartWallet,
      smartWallets,
      smartWalletClient,
      smartAccountAddress: smartWallet?.address as `0x${string}` | undefined,
      isReady: ready && !!smartWallet && !!smartWalletClient,
   };
}
