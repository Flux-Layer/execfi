"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TerminalHeader from "@/components/terminal/TerminalHeader";
import { useDock } from "@/context/DockContext";
import { useResponsive } from "@/hooks/useResponsive";
import { GeneralTab } from "./tabs/GeneralTab";
import { AppearanceTab } from "./tabs/AppearanceTab";
import { PrivacyDataTab } from "./tabs/PrivacyDataTab";
import { AccessibilityTab } from "./tabs/AccessibilityTab";
import { DeveloperTab } from "./tabs/DeveloperTab";

const TABS = [
  { key: "general", label: "General", component: GeneralTab },
  { key: "appearance", label: "Appearance", component: AppearanceTab },
  { key: "privacy", label: "Privacy & Data", component: PrivacyDataTab },
  { key: "accessibility", label: "Accessibility", component: AccessibilityTab },
  { key: "developer", label: "Developer", component: DeveloperTab },
] as const;

export type SettingsTabKey = (typeof TABS)[number]["key"];

export default function SettingsWindow() {
  const {
    settingsState: { open, minimized, fullscreen, version },
    closeSettings,
    minimizeSettings,
    toggleFullscreenSettings,
  } = useDock();

  if (!open) return null;

  return (
    <SettingsWindowContent
      key={version}
      minimized={minimized}
      fullscreen={fullscreen}
      onClose={closeSettings}
      onMinimize={minimizeSettings}
      onToggleFullscreen={toggleFullscreenSettings}
    />
  );
}

type WindowProps = {
  minimized: boolean;
  fullscreen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onToggleFullscreen: () => void;
};

function SettingsWindowContent({ minimized, fullscreen, onClose, onMinimize, onToggleFullscreen }: WindowProps) {
  const { isMobile } = useResponsive();
  const windowRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTabKey>("general");

  const effectiveFullscreen = fullscreen || isMobile;

  const initializePosition = useCallback(() => {
    if (typeof window === "undefined" || effectiveFullscreen) return;
    const node = windowRef.current;
    if (!node) return;
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    setPos({ x: Math.max((window.innerWidth - w) / 2, 0), y: Math.max((window.innerHeight - h) / 2, 0) });
    setReady(true);
  }, [effectiveFullscreen]);

  useEffect(() => {
    const frame = requestAnimationFrame(initializePosition);
    return () => cancelAnimationFrame(frame);
  }, [initializePosition]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      if (effectiveFullscreen) return;
      const node = windowRef.current;
      if (!node) return;
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      const maxX = Math.max(window.innerWidth - w, 0);
      const maxY = Math.max(window.innerHeight - h, 0);
      setPos((prev) => ({ x: Math.min(Math.max(prev.x, 0), maxX), y: Math.min(Math.max(prev.y, 0), maxY) }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [effectiveFullscreen]);

  useEffect(() => {
    if (!effectiveFullscreen) setReady(false);
  }, [effectiveFullscreen]);

  const handleDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (effectiveFullscreen) return;
      const node = windowRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      setDragging(true);

      const handleMove = (ev: PointerEvent) => {
        setPos({ x: Math.max(0, ev.clientX - offsetX), y: Math.max(0, ev.clientY - offsetY) });
      };
      const handleUp = () => {
        setDragging(false);
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove, { passive: true });
      window.addEventListener("pointerup", handleUp, { passive: true });
    },
    [effectiveFullscreen],
  );

  if (minimized) return null;

  return (
    <div className="pointer-events-none">
      <div
        ref={windowRef}
        className={effectiveFullscreen ? "fixed inset-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-[calc(7rem+env(safe-area-inset-bottom))] z-40 flex items-center justify-center pt-safe" : "fixed px-4 z-40"}
        style={effectiveFullscreen ? undefined : { left: pos.x, top: pos.y, visibility: ready ? "visible" : "hidden" }}
      >
        <div
          className={
            effectiveFullscreen
              ? "relative flex h-full w-full md:h-[calc(95vh-4rem)] md:w-[calc(100vw-4rem)] flex-col overflow-hidden md:rounded-2xl border-0 md:border md:border-slate-800 bg-slate-950/95 text-slate-100 shadow-2xl pointer-events-auto"
              : "mx-auto flex h-[36rem] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 text-slate-100 shadow-xl pointer-events-auto"
          }
        >
          <TerminalHeader
            onDragHandle={effectiveFullscreen ? undefined : handleDragStart}
            isDragging={dragging}
            onClose={onClose}
            onMinimize={isMobile ? undefined : onMinimize}
            onToggleFullscreen={isMobile ? undefined : onToggleFullscreen}
            isFullscreen={fullscreen}
            showClock={false}
          />
          <SettingsLayout activeTab={activeTab} onChangeTab={setActiveTab} />
        </div>
      </div>
    </div>
  );
}

type SettingsLayoutProps = {
  activeTab: SettingsTabKey;
  onChangeTab: (tab: SettingsTabKey) => void;
};

function SettingsLayout({ activeTab, onChangeTab }: SettingsLayoutProps) {
  const TabComponent = useMemo(() => TABS.find((tab) => tab.key === activeTab)?.component ?? GeneralTab, [activeTab]);

  return (
    <div className="flex h-[calc(100%-3rem)] flex-col md:flex-row">
      <aside className="w-full border-b border-white/10 bg-slate-950/80 md:w-52 md:border-b-0 md:border-r">
        <nav className="flex flex-row overflow-x-auto md:flex-col">
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                onClick={() => onChangeTab(tab.key)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition md:flex-none md:text-left ${
                  isActive
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "text-slate-300 hover:bg-white/5 hover:text-slate-50"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto bg-slate-950/60">
        <TabComponent />
      </main>
    </div>
  );
}

export function SettingsPreview() {
  return (
    <div className="flex h-full flex-col bg-slate-950/90 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-sm font-semibold text-slate-200">Settings</div>
      </div>
      <div className="space-y-2 text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <span>Theme:</span>
          <span className="text-slate-300">Dark</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Language:</span>
          <span className="text-slate-300">English</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Animations:</span>
          <span className="text-emerald-400">Enabled</span>
        </div>
      </div>
    </div>
  );
}
