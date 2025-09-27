"use client";

import { createContext, useContext, useMemo, useState, ReactNode } from "react";

type TerminalWindowState = {
  open: boolean;
  minimized: boolean;
  fullscreen: boolean;
  version: number;
};

type DockContextValue = {
  terminalState: TerminalWindowState;
  openTerminal: () => void;
  closeTerminal: () => void;
  minimizeTerminal: () => void;
  toggleFullscreenTerminal: () => void;
};

const DockContext = createContext<DockContextValue | undefined>(undefined);

export function DockProvider({ children }: { children: ReactNode }) {
  const [terminalState, setTerminalState] = useState<TerminalWindowState>({
    open: false,
    minimized: false,
    fullscreen: false,
    version: 0,
  });

  const value = useMemo<DockContextValue>(
    () => ({
      terminalState,
      openTerminal: () =>
        setTerminalState((prev) => ({
          ...prev,
          open: true,
          minimized: false,
        })),
      closeTerminal: () =>
        setTerminalState((prev) => ({
          open: false,
          minimized: false,
          fullscreen: false,
          version: prev.version + 1,
        })),
      minimizeTerminal: () =>
        setTerminalState((prev) => ({
          ...prev,
          open: true,
          minimized: true,
          fullscreen: false,
        })),
      toggleFullscreenTerminal: () =>
        setTerminalState((prev) => ({
          ...prev,
          open: true,
          minimized: false,
          fullscreen: !prev.fullscreen,
        })),
    }),
    [terminalState],
  );

  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

export function useDock() {
  const ctx = useContext(DockContext);
  if (!ctx) {
    throw new Error("useDock must be used within DockProvider");
  }
  return ctx;
}
