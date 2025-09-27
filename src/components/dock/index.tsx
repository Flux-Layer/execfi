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
import { useState } from "react";
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
  const { openTerminal } = useDock();
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
      <nav className="pointer-events-auto flex items-end gap-4 rounded-3xl border border-white/10 bg-slate-900/70 px-6 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
        {DOCK_ITEMS.map((item) => {
          const isHover = hovered === item.key;

          return (
            <button
              key={item.key}
              type="button"
              className="relative flex items-center justify-center text-slate-200 focus:outline-none"
              onMouseEnter={() => setHovered(item.key)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(item.key)}
              onBlur={() => setHovered(null)}
              aria-label={item.label}
              onClick={() => {
                if (item.key === "terminal") {
                  openTerminal();
                }
              }}
            >
              <motion.span
                animate={{ scale: isHover ? 1.15 : 1, y: isHover ? -6 : 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/85 text-xl shadow-inner"
              >
                {item.icon}
              </motion.span>

              <AnimatePresence>
                {isHover && (
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
            </button>
          );
        })}
      </nav>
    </div>
  );
}
