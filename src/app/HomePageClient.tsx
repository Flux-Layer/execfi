"use client";

import { useCallback } from "react";
import PageBarLoader from "@components/loader";
import { usePrivy } from "@privy-io/react-auth";
import HSMPromptTerminal from "@/components/terminal/HSMPromptTerminal";
import ExecFiNotesWindow from "@/components/apps/ExecFiNotes";
import ProfileAppWindow from "@/components/apps/Profile";
import BombGameWindow from "@/components/apps/BombGame";
import DesktopShortcut from "@/components/desktop/DesktopShortcut";
import { GiBomber } from "react-icons/gi";
import { useDock } from "@/context/DockContext";

export default function HomePageClient() {
  const privyInstance = usePrivy();
  const { openGame } = useDock();

  const handleBombShortcut = useCallback(() => {
    openGame();
  }, [openGame]);

  return (
    <main className="relative flex h-screen w-full items-center justify-center bg-black">
      <div className="pointer-events-none absolute left-6 top-6 z-30">
        <DesktopShortcut
          icon={<GiBomber className="h-6 w-6" />}
          label="Bomb"
          onActivate={handleBombShortcut}
        />
      </div>

      {privyInstance?.ready ? <HSMPromptTerminal /> : <PageBarLoader />}
      {/* Notes app window (opens via Dock) */}
      <ExecFiNotesWindow />
      {/* Profile app window (opens via Dock) */}
      <ProfileAppWindow />
      {/* Bomb game window (opens via desktop shortcut) */}
      <BombGameWindow />
    </main>
  );
}
