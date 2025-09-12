"use client";

import PageBarLoader from "../components/loader";
import PromptTextInput from "../components/text-input/prompt-input";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useEffect } from "react";
import { useCreateWallet } from "@privy-io/react-auth";
import { usePrivyEOA } from "../hooks/usePrivyEOA";

export default function Home() {
  const privyInstance = usePrivy();
  const wallets = useWallets();
  const { createWallet } = useCreateWallet();
  const {address} = usePrivyEOA()

  useEffect(() => {
     console.log({address})
  },[address])

  const createUserWallet = useCallback(() => {
    try {
      const response = createWallet({});
    } catch (err) {
      console.error(err);
    }
  }, [createWallet]);

  useEffect(() => {
    console.log({ privyInstance });
  }, [privyInstance]);
  useEffect(() => {
    console.log({ wallets });
  }, [wallets]);

  return (
    <main className="w-full h-screen flex items-center justify-center bg-black">
      {privyInstance?.ready ? <PromptTextInput /> : <PageBarLoader />}
    </main>
  );
}
