"use client";
import { BiconomyProvider } from "@biconomy/use-aa";
import { useQueryClient } from "@tanstack/react-query";
import { PropsWithChildren } from "react";
export default function BProvider(props: PropsWithChildren) {
  const biconomyPaymasterApiKey =
    process.env.NEXT_PUBLIC_PAYMASTER_API_KEY || "";
  const bundlerUrl = process.env.NEXT_PUBLIC_BICONOMY_BUNDLER || "";

  const queryClient = useQueryClient();

  return (
    <BiconomyProvider
      config={{
        biconomyPaymasterApiKey,
        bundlerUrl,
        // Add your signer here if you don't want to use the metamask signer
      }}
      queryClient={queryClient}
    >
      {props?.children}
    </BiconomyProvider>
  );
}
