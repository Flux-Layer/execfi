import { usePrivy, useSessionSigners, useWallets } from "@privy-io/react-auth";
import { useEOA } from "./useEOA";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function useSessionSigner() {
  const { selectedWallet } = useEOA();
  const { ready, user } = usePrivy();
  const { addSessionSigners } = useSessionSigners();
  const { ready: walletsReady } = useWallets();

  const [sessionSignerInitialized, setSessionSignerInitialized] =
    useState(false);

  const initSessionSigner = useCallback(async () => {
    if (selectedWallet && ready && user) {
      try {
        const delegatedAccount = user?.linkedAccounts?.find(
          (a) =>
            a?.type === "wallet" &&
            a?.address === selectedWallet?.address &&
            !!a?.delegated,
        );
        console.log({ delegatedAccount });

        if (delegatedAccount) {
          setSessionSignerInitialized(true);
          return console.log("Account has already been delegated");
        }

        const addSessionSignerResponse = await addSessionSigners({
          address: selectedWallet?.address,
          signers: [
            {
              signerId: process.env.NEXT_PUBLIC_PRIVY_SIGNER_ID!,
              policyIds: [], //
            },
          ],
        });

        console.log({ addSessionSignerResponse });
        setSessionSignerInitialized(true);
      } catch (err: any) {
        console.log(err);
      }
    }
  }, [selectedWallet, ready, user]);

  useEffect(() => {
    if (selectedWallet && ready && !sessionSignerInitialized) {
      initSessionSigner();
    }
  }, [ready, selectedWallet]);

  const walletsWithSessionSigners = useMemo(() => {
    if (walletsReady && sessionSignerInitialized) {
      const walletsWithSessionSigners = user?.linkedAccounts?.filter(
        (a) => a?.type === "wallet" && !!a?.delegated,
      );

      console.log({ walletsWithSessionSigners });
    }
  }, [walletsReady, sessionSignerInitialized]);
  useEffect(() => {
    console.log({ walletsWithSessionSigners });
  }, [walletsWithSessionSigners]);

  return { sessionSignerInitialized, walletsWithSessionSigners };
}
