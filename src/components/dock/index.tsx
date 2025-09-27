"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  FiHome,
  FiInfo,
  FiTag,
  FiTerminal,
  FiSettings,
  FiUser,
} from "react-icons/fi";
import { useRef, useState } from "react";
import HSMTerminalBody from "@/components/terminal/HSMTerminalBody";
import TerminalHeader from "@/components/terminal/TerminalHeader";
import { useDock } from "@/context/DockContext";

const DOCK_ITEMS = [
  { key: "home", label: "Home", href: "#home", icon: <FiHome /> },
  { key: "about", label: "About", href: "#about", icon: <FiInfo /> },
  { key: "pricing", label: "Pricing", href: "#pricing", icon: <FiTag /> },
  { key: "terminal", label: "Terminal", href: "#terminal", icon: <FiTerminal /> },
  { key: "settings", label: "Settings", href: "#settings", icon: <FiSettings /> },
  { key: "profile", label: "Profile", href: "#profile", icon: <FiUser /> },
];

export default function Dock() {
  const { terminalState, openTerminal } = useDock();
  const [hovered, setHovered] = useState<string | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const previewInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
      <nav className="pointer-events-auto flex items-end gap-4 rounded-3xl border border-white/10 bg-slate-900/70 px-6 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
        {DOCK_ITEMS.map((item) => {
          const isHover = hovered === item.key;
          const isTerminal = item.key === "terminal";
          const terminalMinimized = isTerminal && terminalState.minimized;

          return (
            <div
              role="button"
              tabIndex={0}
              key={item.key}
              className="relative flex items-center justify-center text-slate-200 focus:outline-none"
              onMouseEnter={() => setHovered(item.key)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(item.key)}
              onBlur={() => setHovered(null)}
              aria-label={item.label}
              onClick={() => {
                if (isTerminal) {
                  openTerminal();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (isTerminal) openTerminal();
                }
              }}
            >
              <motion.span
                animate={{
                  scale: terminalMinimized ? 1.2 : isHover ? 1.15 : isTerminal && terminalState.open ? 1.05 : 1,
                  y: isHover ? -6 : terminalMinimized ? -3 : 0,
                }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/85 text-xl shadow-inner"
              >
                {item.icon}
              </motion.span>

              <AnimatePresence>
                {isHover && !(isTerminal && terminalMinimized) && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="pointer-events-none absolute -top-14 left-1/2 flex -translate-x-1/2 flex-col items-center"
                  >
                    <div className="rounded-full border border-white/15 bg-slate-900/90 px-3 py-1 text-xs font-medium text-slate-100 shadow-lg">
                      {item.label}
                    </div>
                    <div
                      className="mt-1 h-2 w-3 border border-white/15 bg-slate-900/90"
                      style={{ clipPath: "polygon(50% 100%, 0 0, 100% 0)" }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Minimized terminal preview on hover */}
              <AnimatePresence>
                {isTerminal && terminalMinimized && isHover && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 260, damping: 22 }}
                    className="absolute -top-[14rem] left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
                    onClick={() => openTerminal()}
                  >
                    <div className="w-[400px] h-[200px] rounded-2xl border border-white/15 bg-slate-900/95 shadow-2xl overflow-hidden">
                      {/* Live preview (non-interactive) - full terminal shape */}
                      <div ref={previewContainerRef} className="relative h-full w-full pointer-events-none">
                        <div className="absolute inset-0 scale-92 origin-bottom">
                          <div className="h-full w-full font-mono terminal-font-shrink text-left">
                            <TerminalHeader isFullscreen={false} />
                            <div className="h-[calc(100%-3rem)] overflow-hidden">
                              <HSMTerminalBody inputRef={previewInputRef} containerRef={previewContainerRef} />
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Click catcher */}
                      <div className="absolute inset-0" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
