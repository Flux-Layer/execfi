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
import CoinFlipGameWindow from "@/components/apps/CoinFlipGame";
import DesktopShortcut from "@/components/desktop/DesktopShortcut";
import { FaBomb } from "react-icons/fa6";
import { TbCoin } from "react-icons/tb";
import { useDock } from "@/context/DockContext";
import StatusBar from "@/components/status/StatusBar";

export default function HomePageClient() {
  const privyInstance = usePrivy();
  const { openGame, openCoinFlip } = useDock();

  const handleBombShortcut = useCallback(() => {
    openGame();
  }, [openGame]);
  const handleCoinFlipShortcut = useCallback(() => {
    openCoinFlip();
  }, [openCoinFlip]);
  return (
    <main className="relative flex h-screen w-full items-center justify-center bg-black">
      <StatusBar />
      <div className="pointer-events-none absolute left-6 top-20 z-10 flex flex-col gap-3">
        <DesktopShortcut
          icon={<FaBomb className="h-6 w-6" />}
          label="Degen Shooter"
          onActivate={handleBombShortcut}
        />
        <DesktopShortcut
          icon={<TbCoin className="h-6 w-6" />}
          label="CoinFlip"
          onActivate={handleCoinFlipShortcut}
        />
      </div>

      {privyInstance?.ready ? <HSMPromptTerminal /> : <PageBarLoader />}
      {/* Notes app window (opens via Dock) */}
      <ExecFiNotesWindow />
      {/* Profile app window (opens via Dock) */}
      <ProfileAppWindow />
      {/* Bomb game window (opens via desktop shortcut) */}
      <BombGameWindow />
      <CoinFlipGameWindow />
      {/* About app window (opens via Dock) */}
      <AboutWindow />
      {/* Settings app window (opens via Dock) */}
      <SettingsWindow />
    </main>
  );
}
