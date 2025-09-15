"use client";

import useBiconomySA from "@/hooks/useBiconomySA";
import PageBarLoader from "@components/loader";
import { usePrivy } from "@privy-io/react-auth";
import PromptTerminal from "@/components/terminal/PromptTerminal";

export default function Home() {
  const privyInstance = usePrivy();
  const { saAddress } = useBiconomySA();

  console.log({ saAddress });
  return (
    <main className="w-full h-screen flex items-center justify-center bg-black">
      {privyInstance?.ready ? <PromptTerminal /> : <PageBarLoader />}
    </main>
  );
}
