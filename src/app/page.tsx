"use client";

import useZeroDevSA from "../hooks/useZeroDevSA";
import PageBarLoader from "../components/loader";
import PromptTextInput from "../components/text-input/prompt-input";
import { usePrivy, } from "@privy-io/react-auth";

export default function Home() {
  const privyInstance = usePrivy();
   const {} = useZeroDevSA() 
  
  return (
    <main className="w-full h-screen flex items-center justify-center bg-black">
      {privyInstance?.ready ? <PromptTextInput /> : <PageBarLoader />}
    </main>
  );
}
