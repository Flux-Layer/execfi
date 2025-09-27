"use client";

import { createContext, useContext, useMemo, useState, ReactNode } from "react";

type DockContextValue = {
  terminalOpen: boolean;
  openTerminal: () => void;
  closeTerminal: () => void;
};

const DockContext = createContext<DockContextValue | undefined>(undefined);

export function DockProvider({ children }: { children: ReactNode }) {
  const [terminalOpen, setTerminalOpen] = useState(true);

  const value = useMemo<DockContextValue>(
    () => ({
      terminalOpen,
      openTerminal: () => setTerminalOpen(true),
      closeTerminal: () => setTerminalOpen(false),
    }),
    [terminalOpen],
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
