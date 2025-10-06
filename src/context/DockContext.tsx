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

   const value = useMemo<DockContextValue>(
      () => ({
         terminalState,
         docsState,
         profileState,
         openTerminal: () => {
            // On mobile, minimize other apps
            if (isMobile) {
               setDocsState((prev) => ({ ...prev, minimized: true }));
               setProfileState((prev) => ({ ...prev, minimized: true }));
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
      [terminalState, docsState, profileState, isMobile],
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
