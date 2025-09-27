"use client";

import { createContext, useContext, useMemo, useState, ReactNode } from "react";

type WindowState = {
  open: boolean;
  minimized: boolean;
  fullscreen: boolean;
  version: number;
  lastFullscreen?: boolean;
};

type DockContextValue = {
  terminalState: WindowState;
  docsState: WindowState;
  openTerminal: () => void;
  closeTerminal: () => void;
  minimizeTerminal: () => void;
  toggleFullscreenTerminal: () => void;
  openDocs: () => void;
  closeDocs: () => void;
  minimizeDocs: () => void;
  toggleFullscreenDocs: () => void;
};

const DockContext = createContext<DockContextValue | undefined>(undefined);

export function DockProvider({ children }: { children: ReactNode }) {
  const [terminalState, setTerminalState] = useState<WindowState>({
    open: false,
    minimized: false,
    fullscreen: false,
    version: 0,
    lastFullscreen: false,
  });
  const [docsState, setDocsState] = useState<WindowState>({
    open: false,
    minimized: false,
    fullscreen: false,
    version: 0,
    lastFullscreen: false,
  });

  const value = useMemo<DockContextValue>(
    () => ({
      terminalState,
      docsState,
      openTerminal: () =>
        setTerminalState((prev) => ({
          ...prev,
          open: true,
          minimized: false,
          fullscreen: prev.lastFullscreen ? true : prev.fullscreen,
        })),
      closeTerminal: () =>
        setTerminalState((prev) => ({
          open: false,
          minimized: false,
          fullscreen: false,
          version: prev.version + 1,
          lastFullscreen: prev.fullscreen || prev.lastFullscreen,
        })),
      minimizeTerminal: () =>
        setTerminalState((prev) => ({
          ...prev,
          open: true,
          minimized: true,
          lastFullscreen: prev.fullscreen || prev.lastFullscreen,
          fullscreen: false,
        })),
      toggleFullscreenTerminal: () =>
        setTerminalState((prev) => {
          const nextFullscreen = !prev.fullscreen;
          // If entering fullscreen, minimize docs window
          if (nextFullscreen) {
            setDocsState((d) => ({ ...d, minimized: true }));
          }
          return {
            ...prev,
            open: true,
            minimized: false,
            fullscreen: nextFullscreen,
            lastFullscreen: nextFullscreen,
          };
        }),
      openDocs: () =>
        setDocsState((prev) => ({
          ...prev,
          open: true,
          minimized: false,
          fullscreen: prev.lastFullscreen ? true : prev.fullscreen,
        })),
      closeDocs: () =>
        setDocsState((prev) => ({
          open: false,
          minimized: false,
          fullscreen: false,
          version: prev.version + 1,
          lastFullscreen: prev.fullscreen || prev.lastFullscreen,
        })),
      minimizeDocs: () =>
        setDocsState((prev) => ({
          ...prev,
          open: true,
          minimized: true,
          lastFullscreen: prev.fullscreen || prev.lastFullscreen,
          fullscreen: false,
        })),
      toggleFullscreenDocs: () =>
        setDocsState((prev) => {
          const nextFullscreen = !prev.fullscreen;
          if (nextFullscreen) {
            setTerminalState((t) => ({ ...t, minimized: true }));
          }
          return { ...prev, open: true, minimized: false, fullscreen: nextFullscreen, lastFullscreen: nextFullscreen };
        }),
    }),
    [terminalState, docsState],
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
