"use client";

import PageBarLoader from "@components/loader";
import { usePrivy } from "@privy-io/react-auth";
import HSMPromptTerminal from "@/components/terminal/HSMPromptTerminal";
import ExecFiNotesWindow from "@/components/apps/ExecFiNotes";

export default function Home() {
  const privyInstance = usePrivy();

  return (
    <main className="w-full h-screen flex items-center justify-center bg-black">
      {privyInstance?.ready ? <HSMPromptTerminal /> : <PageBarLoader />}
      {/* Notes app window (opens via Dock) */}
      <ExecFiNotesWindow />
    </main>
  );
}
