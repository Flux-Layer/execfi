"use client";

import { useCallback } from "react";
import PageBarLoader from "@components/loader";
import { usePrivy } from "@privy-io/react-auth";
import HSMPromptTerminal from "@/components/terminal/HSMPromptTerminal";
import ExecFiNotesWindow from "@/components/apps/ExecFiNotes";
import ProfileAppWindow from "@/components/apps/Profile";
import BombGameWindow from "@/components/apps/BombGame";
import AboutWindow from "@/components/apps/About";
import SettingsWindow from "@/components/apps/Settings";
import DesktopShortcut from "@/components/desktop/DesktopShortcut";
import { FaBomb } from "react-icons/fa6";
import { useDock } from "@/context/DockContext";

export default function HomePageClient() {
  const privyInstance = usePrivy();
  const { openGame } = useDock();

  const handleBombShortcut = useCallback(() => {
    openGame();
  }, [openGame]);

  return (
    <main className="relative flex h-screen w-full items-center justify-center bg-black">
      <div className="pointer-events-none absolute left-6 top-6 z-10">
        <DesktopShortcut
          icon={<FaBomb className="h-6 w-6" />}
          label="Degen Shooter"
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
      {/* About app window (opens via Dock) */}
      <AboutWindow />
      {/* Settings app window (opens via Dock) */}
      <SettingsWindow />
    </main>
  );
}
