"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  FiHome,
  FiInfo,
  FiTag,
  FiTerminal,
  FiSettings,
  FiUser,
} from "react-icons/fi";

const DOCK_ITEMS = [
  { key: "home", label: "Home", href: "#home", icon: <FiHome /> },
  { key: "about", label: "About", href: "#about", icon: <FiInfo /> },
  { key: "pricing", label: "Pricing", href: "#pricing", icon: <FiTag /> },
  { key: "terminal", label: "Terminal", href: "#terminal", icon: <FiTerminal /> },
  { key: "settings", label: "Settings", href: "#settings", icon: <FiSettings /> },
  { key: "profile", label: "Profile", href: "#profile", icon: <FiUser /> },
];

export default function Dock() {
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
      <nav className="pointer-events-auto flex items-end gap-3 rounded-3xl border border-white/10 bg-slate-900/70 px-6 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
        {DOCK_ITEMS.map((item) => (
          <Link key={item.key} href={item.href} className="flex flex-col items-center gap-1 text-slate-200">
            <motion.span
              whileHover={{ scale: 1.15, y: -4 }}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80 text-xl shadow-inner"
            >
              {item.icon}
            </motion.span>
            <span className="text-[11px] font-medium text-slate-300">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
