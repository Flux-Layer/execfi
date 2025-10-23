"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import TerminalHeader from "@/components/terminal/TerminalHeader";
import { useDock } from "@/context/DockContext";
import { useResponsive } from "@/hooks/useResponsive";
import { APP_INFO } from "@/lib/constants/appInfo";
import {
  FiGithub,
  FiTwitter,
  FiExternalLink,
  FiCheck,
  FiShield,
  FiActivity,
  FiChevronRight,
} from "react-icons/fi";
import { RiDiscordLine } from "react-icons/ri";

export default function AboutWindow() {
  const {
    aboutState: { open, minimized, fullscreen, version },
    closeAbout,
    minimizeAbout,
    toggleFullscreenAbout,
  } = useDock();

  if (!open) return null;

  return (
    <AboutContent
      key={version}
      minimized={minimized}
      fullscreen={fullscreen}
      onClose={closeAbout}
      onMinimize={minimizeAbout}
      onToggleFullscreen={toggleFullscreenAbout}
    />
  );
}

type Props = {
  minimized: boolean;
  fullscreen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onToggleFullscreen: () => void;
};

function AboutContent({ minimized, fullscreen, onClose, onMinimize, onToggleFullscreen }: Props) {
  const { isMobile } = useResponsive();
  const windowRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const effectiveFullscreen = fullscreen || isMobile;

  const initPos = useCallback(() => {
    if (typeof window === "undefined" || effectiveFullscreen) return;
    const node = windowRef.current;
    if (!node) return;
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    setPos({ x: Math.max((window.innerWidth - w) / 2, 0), y: Math.max((window.innerHeight - h) / 2, 0) });
    setIsReady(true);
  }, [effectiveFullscreen]);

  useEffect(() => {
    const r = requestAnimationFrame(initPos);
    return () => cancelAnimationFrame(r);
  }, [initPos]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      if (effectiveFullscreen) return;
      const node = windowRef.current;
      if (!node) return;
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      const maxX = Math.max(window.innerWidth - w, 0);
      const maxY = Math.max(window.innerHeight - h, 0);
      setPos((p) => ({ x: Math.min(Math.max(p.x, 0), maxX), y: Math.min(Math.max(p.y, 0), maxY) }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [effectiveFullscreen]);

  useEffect(() => {
    if (!effectiveFullscreen) setIsReady(false);
  }, [effectiveFullscreen]);

  if (minimized) return null;

  return (
    <div className="pointer-events-none">
      <div
        ref={windowRef}
        className={effectiveFullscreen ? "fixed inset-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-[calc(7rem+env(safe-area-inset-bottom))] z-40 flex items-center justify-center pt-safe" : "fixed px-4 z-40"}
        style={effectiveFullscreen ? undefined : { left: pos.x, top: pos.y, visibility: isReady ? "visible" : "hidden" }}
      >
        <div
          className={
            effectiveFullscreen
              ? "relative flex h-full w-full md:h-[calc(95vh-4rem)] md:w-[calc(100vw-4rem)] flex-col overflow-hidden md:rounded-2xl border-0 md:border md:border-slate-800 bg-slate-950/95 shadow-2xl pointer-events-auto"
              : "mx-auto h-[34rem] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 shadow-xl pointer-events-auto"
          }
        >
          <TerminalHeader
            onDragHandle={(e) => {
              if (effectiveFullscreen) return;
              const rect = windowRef.current?.getBoundingClientRect();
              if (!rect) return;
              const offsetX = e.clientX - rect.left;
              const offsetY = e.clientY - rect.top;
              setDragging(true);
              const onMove = (ev: PointerEvent) => {
                setPos({ x: Math.max(0, ev.clientX - offsetX), y: Math.max(0, ev.clientY - offsetY) });
              };
              const onUp = () => {
                setDragging(false);
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
              };
              window.addEventListener("pointermove", onMove, { passive: true });
              window.addEventListener("pointerup", onUp, { passive: true });
            }}
            isDragging={dragging}
            onClose={onClose}
            onMinimize={isMobile ? undefined : onMinimize}
            onToggleFullscreen={isMobile ? undefined : onToggleFullscreen}
            isFullscreen={fullscreen}
            showClock={false}
          />
          <div className="h-[calc(100%-3rem)] overflow-auto">
            <AboutApp />
          </div>
        </div>
      </div>
    </div>
  );
}

const LINKS = [
  {
    label: "GitHub Repository",
    description: "View source code and contribute",
    url: "https://github.com/Flux-Layer/execfi",
    icon: <FiGithub className="w-5 h-5" />,
  },
  {
    label: "Twitter/X",
    description: "Follow for updates",
    url: "https://twitter.com/execfiHQ",
    icon: <FiTwitter className="w-5 h-5" />,
  },
  {
    label: "Discord Community",
    description: "Get support and connect",
    url: "https://discord.gg/AChgaEpMxK",
    icon: <RiDiscordLine className="w-5 h-5" />,
  },
];

function AboutApp() {
  return (
    <div className="pb-6">
      {/* Hero Section */}
      <section className="text-center py-8 px-6 bg-gradient-to-b from-emerald-900/20 to-transparent">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="text-4xl font-bold text-emerald-400">{APP_INFO.name}</div>
        </div>
        <p className="text-lg text-slate-300 mb-3">
          GM, welcome to ExecFi — the GameFi operating system for Base. It still feels like a slick
          desktop, but every window opens an onchain arcade loop, quest log, or DeFi control panel
          ready to run with your wallet of choice, with optional Coinbase Smart Wallet support if
          you want the one-tap experience.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/60 border border-slate-700 text-xs text-slate-400">
          <span>v{APP_INFO.version}</span>
          <span className="text-slate-600">•</span>
          <span>{APP_INFO.buildDate}</span>
        </div>
      </section>

      {/* What is ExecFi */}
      <section className="mx-6 mb-6 rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <h2 className="text-xl font-semibold text-slate-100 mb-4">What is ExecFi?</h2>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          gm fren — ExecFi is your always-on GameFi co-pilot. The desktop keeps arcade loops and
          quests one click away, while the terminal still translates slash-commands and intents into
          policy-checked, simulated transactions. The vibe stays playful; the rails stay transparent
          and non-custodial. Let’s buidl the lobby together.
        </p>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <FiCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-200">Arcade-first UX</h3>
              <p className="text-xs text-slate-400">Cinematic CoinFlip &amp; Degen Shooter loops with provable fairness</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <FiShield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-200">Questing layer</h3>
              <p className="text-xs text-slate-400">Daily XP, Sunday hunts, and status boosts surfaced right in the HUD</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <FiActivity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-200">Smart execution</h3>
              <p className="text-xs text-slate-400">AI-assisted terminal, policy guardrails, and receipts for every cashout</p>
            </div>
          </div>
        </div>
      </section>

      {/* Experiences */}
      <section className="mx-6 mb-6 rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <h2 className="text-xl font-semibold text-slate-100 mb-4">Daily Run</h2>
        <div className="space-y-4 text-sm text-slate-300">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Flip with provable odds</h3>
            <p className="text-xs text-slate-400">
              A fully onchain coin flip with provable fairness, smart-wallet payouts, history
              verification, and a cinematic interface.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Clear the Degen Shooter board</h3>
            <p className="text-xs text-slate-400">
              Master the mini strategy shooter: place mines, climb multipliers, reveal fairness, and
              cash out through vault-linked smart contracts.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Ship quests from the terminal</h3>
            <p className="text-xs text-slate-400">
              Slash commands like <code>/login</code>, <code>/balance</code>, and natural-language intents drive DeFi
              actions that feed back into your XP and quest progression.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Track XP like patch notes</h3>
            <p className="text-xs text-slate-400">
              Earn XP across mini apps, unlock Sunday quest rotations, and view breakdowns directly
              from the status bar or terminal.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-6 mb-6 rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <h2 className="text-xl font-semibold text-slate-100 mb-4">FAQ</h2>
        <div className="space-y-4 text-sm text-slate-300">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">gm, do I need a smart account?</h3>
            <p className="text-xs text-slate-400">
              Nope. Bring any Base wallet and you’re good. We offer an optional Coinbase Smart
              Wallet bridge if you want one-click sessions, but the arcade plays just fine with your
              usual EOA.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">How provably fair are the games?</h3>
            <p className="text-xs text-slate-400">
              CoinFlip and Degen Shooter are provably fair: every round publishes server/client
              seeds, exposes verification modals, and ships API endpoints so you can replay the math
              before claiming rewards.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Where does all this XP live?</h3>
            <p className="text-xs text-slate-400">
              XP is written to onchain registries and surfaced in the status bar. Sunday quests and
              future drops reference the same ledger, so progress persists across sessions.
            </p>
          </div>
        </div>
      </section>

      {/* Links */}
      <section className="mx-6 mb-6 rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <h2 className="text-xl font-semibold text-slate-100 mb-4">Links & Resources</h2>
        <div className="grid gap-3">
          {LINKS.map(link => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl border border-slate-700 bg-slate-800/40 hover:bg-slate-800/60 hover:border-emerald-500/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-700/60 text-slate-300 group-hover:text-emerald-400 transition-colors">
                  {link.icon}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-200">{link.label}</div>
                  <div className="text-xs text-slate-400">{link.description}</div>
                </div>
              </div>
              <FiExternalLink className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
            </a>
          ))}
        </div>
      </section>

      {/* Legal */}
      <section className="mx-6 mb-6 rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <h2 className="text-xl font-semibold text-slate-100 mb-4">Legal & Compliance</h2>
        <div className="space-y-3 text-sm">
          <a href="/privacy" className="flex items-center justify-between text-slate-300 hover:text-emerald-400 transition-colors">
            <span>Privacy Policy</span>
            <FiChevronRight className="w-4 h-4" />
          </a>
          <a href="/terms" className="flex items-center justify-between text-slate-300 hover:text-emerald-400 transition-colors">
            <span>Terms of Service</span>
            <FiChevronRight className="w-4 h-4" />
          </a>
          <div className="pt-3 border-t border-white/10">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} ExecFi. All rights reserved.
            </p>
            <p className="text-xs text-slate-500 mt-1">Licensed under MIT License</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export function AboutPreview() {
  return (
    <div className="flex h-full flex-col bg-slate-950/90 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-2xl font-bold text-emerald-400">{APP_INFO.name}</div>
        <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-400">
          v{APP_INFO.version}
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed mb-3">
        {APP_INFO.description}
      </p>
      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
        <div>React 19.1.0</div>
        <div>Next.js 15.5.2</div>
        <div>Wagmi 2.16.9</div>
        <div>Privy 2.24.0</div>
      </div>
    </div>
  );
}
