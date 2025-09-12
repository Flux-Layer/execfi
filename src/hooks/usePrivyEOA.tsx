"use client";
import { useWallets } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth";
import { useEffect, useState } from "react";

export function usePrivyEOA() {
  const { createWallet } = useCreateWallet({
    onSuccess: ({ wallet }) => {
      console.log("Created wallet ", wallet);
    },
    onError: (error) => {
      console.error("Failed to create wallet with error ", error);
    },
  });
  const { wallets } = useWallets();
  const [EOA, setEOA] = useState<any>('')

  useEffect(() => {

     const eoa = wallets?.find((w) => w.walletClientType === "privy");
     if (!eoa) {
        console.log("No embedded EOA available");
        createWallet();
        return
     }

     setEOA(eoa)




  },[wallets])


  return {
    getEip1193: () => EOA?.getEthereumProvider(), // standard EIP-1193
    address: EOA?.address,
    EOA
  };
}
