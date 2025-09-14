"use client";

import useZeroDevSA from "@hooks/useZeroDevSA";
import PageBarLoader from "@components/loader";
import { usePrivy, } from "@privy-io/react-auth";
import PromptTerminal from "@components/terminal-input"

export default function Home() {
  const privyInstance = usePrivy();
   const {} = useZeroDevSA() 
  
  return (
    <main className="w-full h-screen flex items-center justify-center bg-black">
      {privyInstance?.ready ? <PromptTerminal/> : <PageBarLoader />}
    </main>
  );
}
