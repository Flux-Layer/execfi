"use client";

import { createContext, useContext, useMemo, useState, ReactNode, useEffect } from "react";

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
   profileState: WindowState;
   gameState: WindowState;
   aboutState: WindowState;
   settingsState: WindowState;
   minimizeAllApps: () => void;
   openTerminal: () => void;
   closeTerminal: () => void;
   minimizeTerminal: () => void;
   toggleFullscreenTerminal: () => void;
   openDocs: () => void;
   closeDocs: () => void;
   minimizeDocs: () => void;
   toggleFullscreenDocs: () => void;
   openProfile: () => void;
   closeProfile: () => void;
   minimizeProfile: () => void;
   toggleFullscreenProfile: () => void;
   openGame: () => void;
   closeGame: () => void;
   minimizeGame: () => void;
   toggleFullscreenGame: () => void;
   openAbout: () => void;
   closeAbout: () => void;
   minimizeAbout: () => void;
   toggleFullscreenAbout: () => void;
   openSettings: () => void;
   closeSettings: () => void;
   minimizeSettings: () => void;
   toggleFullscreenSettings: () => void;
};

const DockContext = createContext<DockContextValue | undefined>(undefined);

export function DockProvider({ children }: { children: ReactNode }) {
   const [isMobile, setIsMobile] = useState(false);
   
   useEffect(() => {
      const checkMobile = () => setIsMobile(window.innerWidth < 768);
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
   }, []);

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
   const [profileState, setProfileState] = useState<WindowState>({
      open: false,
      minimized: false,
      fullscreen: false,
      version: 0,
      lastFullscreen: false,
   });
   const [gameState, setGameState] = useState<WindowState>({
      open: false,
      minimized: false,
      fullscreen: false,
      version: 0,
      lastFullscreen: false,
   });
   const [aboutState, setAboutState] = useState<WindowState>({
      open: false,
      minimized: false,
      fullscreen: false,
      version: 0,
      lastFullscreen: false,
   });
   const [settingsState, setSettingsState] = useState<WindowState>({
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
         profileState,
         gameState,
         aboutState,
         settingsState,
         minimizeAllApps: () => {
            const minimizeIfOpen = (setter: typeof setTerminalState) => {
               setter((prev) => {
                  if (!prev.open) {
                     return prev;
                  }

                  if (prev.minimized && !prev.fullscreen) {
                     return prev;
                  }

                  return {
                     ...prev,
                     minimized: true,
                     fullscreen: false,
                     lastFullscreen: prev.fullscreen || prev.lastFullscreen,
                  };
               });
            };

            minimizeIfOpen(setTerminalState);
            minimizeIfOpen(setDocsState);
            minimizeIfOpen(setProfileState);
            minimizeIfOpen(setGameState);
            minimizeIfOpen(setAboutState);
            minimizeIfOpen(setSettingsState);
         },
         openTerminal: () => {
            // On mobile, minimize other apps
            if (isMobile) {
               setDocsState((prev) => ({ ...prev, minimized: true }));
               setProfileState((prev) => ({ ...prev, minimized: true }));
               setGameState((prev) => ({ ...prev, minimized: true }));
               setAboutState((prev) => ({ ...prev, minimized: true }));
               setSettingsState((prev) => ({ ...prev, minimized: true }));
            }
            setTerminalState((prev) => ({
               ...prev,
               open: true,
               minimized: false,
               fullscreen: prev.lastFullscreen ? true : prev.fullscreen,
            }));
         },
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
                  setProfileState((p) => ({ ...p, minimized: true }));
                  setGameState((g) => ({ ...g, minimized: true }));
                  setAboutState((a) => ({ ...a, minimized: true }));
                  setSettingsState((s) => ({ ...s, minimized: true }));
               }
               return {
                  ...prev,
                  open: true,
                  minimized: false,
                  fullscreen: nextFullscreen,
                  lastFullscreen: nextFullscreen,
               };
            }),
         openDocs: () => {
            // On mobile, minimize other apps
            if (isMobile) {
               setTerminalState((prev) => ({ ...prev, minimized: true }));
               setProfileState((prev) => ({ ...prev, minimized: true }));
               setGameState((prev) => ({ ...prev, minimized: true }));
               setAboutState((prev) => ({ ...prev, minimized: true }));
               setSettingsState((prev) => ({ ...prev, minimized: true }));
            }
            setDocsState((prev) => ({
               ...prev,
               open: true,
               minimized: false,
               fullscreen: prev.lastFullscreen ? true : prev.fullscreen,
            }));
         },
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
                  setProfileState((p) => ({ ...p, minimized: true }));
                  setGameState((g) => ({ ...g, minimized: true }));
                  setAboutState((a) => ({ ...a, minimized: true }));
                  setSettingsState((s) => ({ ...s, minimized: true }));
               }
               return {
                  ...prev,
                  open: true,
                  minimized: false,
                  fullscreen: nextFullscreen,
                  lastFullscreen: nextFullscreen,
               };
            }),
         openProfile: () => {
            // On mobile, minimize other apps
            if (isMobile) {
               setTerminalState((prev) => ({ ...prev, minimized: true }));
               setDocsState((prev) => ({ ...prev, minimized: true }));
               setGameState((prev) => ({ ...prev, minimized: true }));
               setAboutState((prev) => ({ ...prev, minimized: true }));
               setSettingsState((prev) => ({ ...prev, minimized: true }));
            }
            setProfileState((prev) => ({
               ...prev,
               open: true,
               minimized: false,
               fullscreen: prev.lastFullscreen ? true : prev.fullscreen,
            }));
         },
         closeProfile: () =>
            setProfileState((prev) => ({
               open: false,
               minimized: false,
               fullscreen: false,
               version: prev.version + 1,
               lastFullscreen: prev.fullscreen || prev.lastFullscreen,
            })),
         minimizeProfile: () =>
            setProfileState((prev) => ({
               ...prev,
               open: true,
               minimized: true,
               lastFullscreen: prev.fullscreen || prev.lastFullscreen,
               fullscreen: false,
            })),
         toggleFullscreenProfile: () =>
            setProfileState((prev) => {
               const nextFullscreen = !prev.fullscreen;
               if (nextFullscreen) {
                  setTerminalState((t) => ({ ...t, minimized: true }));
                  setDocsState((d) => ({ ...d, minimized: true }));
                  setGameState((g) => ({ ...g, minimized: true }));
                  setAboutState((a) => ({ ...a, minimized: true }));
                  setSettingsState((s) => ({ ...s, minimized: true }));
               }
               return {
                  ...prev,
                  open: true,
                  minimized: false,
                  fullscreen: nextFullscreen,
                  lastFullscreen: nextFullscreen,
               };
            }),
         openGame: () => {
            if (isMobile) {
               setTerminalState((prev) => ({ ...prev, minimized: true }));
               setDocsState((prev) => ({ ...prev, minimized: true }));
               setProfileState((prev) => ({ ...prev, minimized: true }));
               setAboutState((prev) => ({ ...prev, minimized: true }));
               setSettingsState((prev) => ({ ...prev, minimized: true }));
            }
            setGameState((prev) => ({
               ...prev,
               open: true,
               minimized: false,
               fullscreen: prev.lastFullscreen ? true : prev.fullscreen,
            }));
         },
         closeGame: () =>
            setGameState((prev) => ({
               open: false,
               minimized: false,
               fullscreen: false,
               version: prev.version + 1,
               lastFullscreen: prev.fullscreen || prev.lastFullscreen,
            })),
         minimizeGame: () =>
            setGameState((prev) => ({
               ...prev,
               open: true,
               minimized: true,
               lastFullscreen: prev.fullscreen || prev.lastFullscreen,
               fullscreen: false,
            })),
         toggleFullscreenGame: () =>
            setGameState((prev) => {
               const nextFullscreen = !prev.fullscreen;
               if (nextFullscreen) {
                  setTerminalState((t) => ({ ...t, minimized: true }));
                  setDocsState((d) => ({ ...d, minimized: true }));
                  setProfileState((p) => ({ ...p, minimized: true }));
                  setAboutState((a) => ({ ...a, minimized: true }));
                  setSettingsState ((s) => ({ ...s, minimized: true }));
               }
               return {
                  ...prev,
                  open: true,
                  minimized: false,
                  fullscreen: nextFullscreen,
                  lastFullscreen: nextFullscreen,
               };
            }),
         openAbout: () => {
            if (isMobile) {
               setTerminalState((prev) => ({ ...prev, minimized: true }));
               setDocsState((prev) => ({ ...prev, minimized: true }));
               setProfileState((prev) => ({ ...prev, minimized: true }));
               setGameState((prev) => ({ ...prev, minimized: true }));
               setSettingsState((prev) => ({ ...prev, minimized: true }));
            }
            setAboutState((prev) => ({
               ...prev,
               open: true,
               minimized: false,
               fullscreen: prev.lastFullscreen ? true : prev.fullscreen,
            }));
         },
         closeAbout: () =>
            setAboutState((prev) => ({
               open: false,
               minimized: false,
               fullscreen: false,
               version: prev.version + 1,
               lastFullscreen: prev.fullscreen || prev.lastFullscreen,
            })),
         minimizeAbout: () =>
            setAboutState((prev) => ({
               ...prev,
               open: true,
               minimized: true,
               lastFullscreen: prev.fullscreen || prev.lastFullscreen,
               fullscreen: false,
            })),
         toggleFullscreenAbout: () =>
            setAboutState((prev) => {
               const nextFullscreen = !prev.fullscreen;
               if (nextFullscreen) {
                  setTerminalState((t) => ({ ...t, minimized: true }));
                  setDocsState((d) => ({ ...d, minimized: true }));
                  setProfileState((p) => ({ ...p, minimized: true }));
                  setGameState((g) => ({ ...g, minimized: true }));
                  setSettingsState((s) => ({ ...s, minimized: true }));
               }
               return {
                  ...prev,
                  open: true,
                  minimized: false,
                  fullscreen: nextFullscreen,
                  lastFullscreen: nextFullscreen,
               };
            }),
         openSettings: () => {
            if (isMobile) {
               setTerminalState((prev) => ({ ...prev, minimized: true }));
               setDocsState((prev) => ({ ...prev, minimized: true }));
               setProfileState((prev) => ({ ...prev, minimized: true }));
               setGameState((prev) => ({ ...prev, minimized: true }));
               setAboutState((prev) => ({ ...prev, minimized: true }));
            }
            setSettingsState((prev) => ({
               ...prev,
               open: true,
               minimized: false,
               fullscreen: prev.lastFullscreen ? true : prev.fullscreen,
            }));
         },
         closeSettings: () =>
            setSettingsState((prev) => ({
               open: false,
               minimized: false,
               fullscreen: false,
               version: prev.version + 1,
               lastFullscreen: prev.fullscreen || prev.lastFullscreen,
            })),
         minimizeSettings: () =>
            setSettingsState((prev) => ({
               ...prev,
               open: true,
               minimized: true,
               lastFullscreen: prev.fullscreen || prev.lastFullscreen,
               fullscreen: false,
            })),
         toggleFullscreenSettings: () =>
            setSettingsState((prev) => {
               const nextFullscreen = !prev.fullscreen;
               if (nextFullscreen) {
                  setTerminalState((t) => ({ ...t, minimized: true }));
                  setDocsState((d) => ({ ...d, minimized: true }));
                  setProfileState((p) => ({ ...p, minimized: true }));
                  setGameState((g) => ({ ...g, minimized: true }));
                  setAboutState((a) => ({ ...a, minimized: true }));
               }
               return {
                  ...prev,
                  open: true,
                  minimized: false,
                  fullscreen: nextFullscreen,
                  lastFullscreen: nextFullscreen,
               };
            }),
      }),
      [terminalState, docsState, profileState, gameState, aboutState, settingsState, isMobile],
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
