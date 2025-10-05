"use client";

import PageBarLoader from "@components/loader";
import { usePrivy } from "@privy-io/react-auth";
import HSMPromptTerminal from "@/components/terminal/HSMPromptTerminal";
import ExecFiNotesWindow from "@/components/apps/ExecFiNotes";
import ProfileAppWindow from "@/components/apps/Profile";

export default function HomePageClient() {
  const privyInstance = usePrivy();

  return (
    <main className="w-full h-screen flex items-center justify-center bg-black">
      {privyInstance?.ready ? <HSMPromptTerminal /> : <PageBarLoader />}
      {/* Notes app window (opens via Dock) */}
      <ExecFiNotesWindow />
      {/* Profile app window (opens via Dock) */}
      <ProfileAppWindow />
    </main>
  );
}
