"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TerminalHeader from "@/components/terminal/TerminalHeader";
import { useDock } from "@/context/DockContext";
import { ProfileProvider, useProfileContext } from "./ProfileContext";
import { OverviewTab } from "./tabs/OverviewTab";
import { WalletsTab } from "./tabs/WalletsTab";
import { PoliciesTab } from "./tabs/PoliciesTab";
import { ActivityTab } from "./tabs/ActivityTab";
import { SecurityTab } from "./tabs/SecurityTab";
import { PreferencesTab } from "./tabs/PreferencesTab";

const TABS = [
  { key: "overview", label: "Overview", component: OverviewTab },
  { key: "wallets", label: "Wallets", component: WalletsTab },
  { key: "policies", label: "Policies", component: PoliciesTab },
  { key: "activity", label: "Activity", component: ActivityTab },
  { key: "security", label: "Security", component: SecurityTab },
  { key: "preferences", label: "Preferences", component: PreferencesTab },
] as const;

export type ProfileTabKey = (typeof TABS)[number]["key"];

export default function ProfileAppWindow() {
  const {
    profileState: { open, minimized, fullscreen, version },
    closeProfile,
    minimizeProfile,
    toggleFullscreenProfile,
  } = useDock();

  if (!open) return null;

  return (
    <ProfileWindowContent
      key={version}
      minimized={minimized}
      fullscreen={fullscreen}
      onClose={closeProfile}
      onMinimize={minimizeProfile}
      onToggleFullscreen={toggleFullscreenProfile}
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

function ProfileWindowContent({ minimized, fullscreen, onClose, onMinimize, onToggleFullscreen }: WindowProps) {
  const windowRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wasFullscreenRef = useRef(fullscreen);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("overview");

  const initializePosition = useCallback(() => {
    if (typeof window === "undefined" || fullscreen) return;
    const node = windowRef.current;
    if (!node) return;
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    setPos({ x: Math.max((window.innerWidth - w) / 2, 0), y: Math.max((window.innerHeight - h) / 2, 0) });
    setReady(true);
  }, [fullscreen]);

  useEffect(() => {
    const frame = requestAnimationFrame(initializePosition);
    return () => cancelAnimationFrame(frame);
  }, [initializePosition]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      if (fullscreen) return;
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
  }, [fullscreen]);

  useEffect(() => {
    // Reset ready when transitioning from fullscreen to windowed
    if (wasFullscreenRef.current && !fullscreen) {
      setReady(false);
    }
    wasFullscreenRef.current = fullscreen;
  }, [fullscreen]);

  const handleDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (fullscreen) return;
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
    [fullscreen],
  );

  if (minimized) return null;

  return (
    <div className="pointer-events-none">
      <div
        ref={windowRef}
        className={fullscreen ? "fixed inset-0 pb-24 z-40 flex items-center justify-center" : "fixed px-4 z-40"}
        style={fullscreen ? undefined : { left: pos.x, top: pos.y, visibility: ready ? "visible" : "hidden" }}
      >
        <div
          ref={containerRef}
          className={
            fullscreen
              ? "relative flex h-[calc(95vh-4rem)] w-[calc(100vw-4rem)] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 text-slate-100 shadow-2xl pointer-events-auto"
              : "mx-auto flex h-[32rem] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 text-slate-100 shadow-xl pointer-events-auto"
          }
        >
          <TerminalHeader
            onDragHandle={handleDragStart}
            isDragging={dragging}
            onClose={onClose}
            onMinimize={onMinimize}
            onToggleFullscreen={onToggleFullscreen}
            isFullscreen={fullscreen}
            showClock={false}
          />
          <ProfileProvider>
            <ProfileLayout activeTab={activeTab} onChangeTab={setActiveTab} fullscreen={fullscreen} />
          </ProfileProvider>
        </div>
      </div>
    </div>
  );
}

type ProfileLayoutProps = {
  activeTab: ProfileTabKey;
  onChangeTab: (tab: ProfileTabKey) => void;
  fullscreen: boolean;
};

function ProfileLayout({ activeTab, onChangeTab, fullscreen }: ProfileLayoutProps) {
  const TabComponent = useMemo(() => TABS.find((tab) => tab.key === activeTab)?.component ?? OverviewTab, [activeTab]);

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

export function ProfilePreview() {
  return (
    <ProfileProvider>
      <ProfilePreviewContent />
    </ProfileProvider>
  );
}

function ProfilePreviewContent() {
  const { identity, eoaWallets, policy } = useProfileContext();

  return (
    <div className="flex h-full flex-col bg-slate-950/90">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-slate-300">
        <span>{identity.email ?? identity.userId ?? "Profile"}</span>
        <span>{policy.metadata.preset.toUpperCase()}</span>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-1.5 px-4 text-xs text-slate-400">
        <span>{eoaWallets.length} linked wallet{eoaWallets.length === 1 ? "" : "s"}</span>
        <span>Policy version {policy.metadata.version}</span>
        <span>Last updated {new Date(policy.metadata.lastModified).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
