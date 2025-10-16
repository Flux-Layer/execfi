"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
   FiHome,
   FiInfo,
   FiFileText,
   FiTerminal,
   FiSettings,
   FiUser,
} from "react-icons/fi";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import HSMTerminalBody from "@/components/terminal/HSMTerminalBody";
import TerminalHeader from "@/components/terminal/TerminalHeader";
import { useDock } from "@/context/DockContext";
import ExecFiNotesWindow, { NotesApp } from "@/components/apps/ExecFiNotes";
import { ProfilePreview } from "@/components/apps/Profile";
import { useResponsive } from "@/hooks/useResponsive";

const DOCK_ITEMS = [
   { key: "home", label: "Home", href: "#home", icon: <FiHome /> },
   { key: "about", label: "About", href: "#about", icon: <FiInfo /> },
   { key: "pricing", label: "Notes", href: "/execfi", icon: <FiFileText /> },
   {
      key: "terminal",
      label: "Terminal",
      href: "#terminal",
      icon: <FiTerminal />,
   },
   {
      key: "settings",
      label: "Settings",
      href: "#settings",
      icon: <FiSettings />,
   },
   { key: "profile", label: "Profile", href: "#profile", icon: <FiUser /> },
];

export default function Dock() {
   const {
      terminalState,
      docsState,
      profileState,
      openTerminal,
      openDocs,
      openProfile,
      minimizeTerminal,
      minimizeDocs,
      minimizeProfile,
   } = useDock();
   const { isMobile } = useResponsive();
   const [hovered, setHovered] = useState<string | null>(null);
   const previewContainerRef = useRef<HTMLDivElement | null>(null);
   const previewInputRef = useRef<HTMLInputElement | null>(null);
   const router = useRouter();

   return (
      <div className="pointer-events-none fixed bottom-0 md:bottom-6 left-0 md:left-1/2 right-0 md:right-auto z-40 md:-translate-x-1/2">
         <nav
            data-onboarding-id="dock"
            className="pointer-events-auto flex items-end md:gap-4
                         md:rounded-3xl md:border md:border-white/10 md:bg-slate-900/70 md:px-6 md:py-3
                         bg-slate-950/95 border-t border-white/10 md:border-t-0
                         md:shadow-2xl md:shadow-black/40 backdrop-blur-xl relative
                         justify-around md:justify-start py-2 md:py-3
                         safe-area-inset-bottom ">
            {DOCK_ITEMS.map((item) => {
               const isHover = hovered === item.key && !isMobile;
               const isTerminal = item.key === "terminal";
               const terminalMinimized = isTerminal && terminalState.minimized;
               const terminalActive = isTerminal && terminalState.open && !terminalState.minimized;
               const isDocs = item.key === "pricing";
               const docsMinimized = isDocs && docsState.minimized;
               const docsActive = isDocs && docsState.open && !docsState.minimized;
               const isProfile = item.key === "profile";
               const profileMinimized = isProfile && profileState.minimized;
               const profileActive = isProfile && profileState.open && !profileState.minimized;
               const isActive = terminalActive || docsActive || profileActive;

               return (
                  <div
                     role="button"
                     tabIndex={0}
                     key={item.key}
                     data-onboarding-id={`dock-${item.key}`}
                     className="mb-2 relative flex flex-col items-center justify-center text-slate-200 focus:outline-none min-w-[44px] md:min-w-0"
                     onMouseEnter={() => !isMobile && setHovered(item.key)}
                     onMouseLeave={() => !isMobile && setHovered(null)}
                     onFocus={() => !isMobile && setHovered(item.key)}
                     onBlur={() => !isMobile && setHovered(null)}
                     aria-label={item.label}
                     onClick={() => {
                        if (isTerminal) {
                           if (terminalState.open && !terminalState.minimized) {
                              minimizeTerminal();
                           } else {
                              openTerminal();
                           }
                        } else if (item.key === "pricing") {
                           if (docsState.open && !docsState.minimized) {
                              minimizeDocs();
                           } else {
                              openDocs();
                           }
                        } else if (isProfile) {
                           if (profileState.open && !profileState.minimized) {
                              minimizeProfile();
                           } else {
                              openProfile();
                           }
                        }
                     }}
                     onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                           e.preventDefault();
                           if (isTerminal) {
                              if (terminalState.open && !terminalState.minimized) {
                                 minimizeTerminal();
                              } else {
                                 openTerminal();
                              }
                           } else if (item.key === "pricing") {
                              if (docsState.open && !docsState.minimized) {
                                 minimizeDocs();
                              } else {
                                 openDocs();
                              }
                           } else if (isProfile) {
                              if (profileState.open && !profileState.minimized) {
                                 minimizeProfile();
                              } else {
                                 openProfile();
                              }
                           }
                        }
                     }}
                  >
                     <motion.span
                        animate={{
                           scale:
                              terminalMinimized || docsMinimized || profileMinimized
                                 ? 1.2
                                 : isHover
                                    ? 1.15
                                    : (isTerminal && terminalState.open) ||
                                       (isProfile && profileState.open)
                                       ? 1.05
                                       : 1,
                           y: !isMobile && isHover
                              ? -6
                              : !isMobile && (terminalMinimized || docsMinimized || profileMinimized)
                                 ? -3
                                 : 0,
                        }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        className="flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-2xl bg-slate-800/85 text-lg md:text-xl shadow-inner"
                     >
                        {item.icon}
                     </motion.span>
                     
                     {/* Mobile: Active indicator */}
                     {isMobile && isActive && (
                        <motion.div
                           layoutId="activeTab"
                           className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500"
                           initial={{ opacity: 0 }}
                           animate={{ opacity: 1 }}
                           exit={{ opacity: 0 }}
                        />
                     )}
                     
                     {/* Mobile: Label below icon */}
                     {isMobile && (
                        <span className="text-[10px] text-slate-400 mt-1 font-medium">
                           {item.label}
                        </span>
                     )}

                     {/* Desktop: Hover tooltip */}
                     {!isMobile && (
                        <AnimatePresence>
                           {isHover &&
                              !(
                                 (isTerminal && terminalMinimized) ||
                                 (isDocs && docsMinimized)
                              ) && (
                                 <motion.div
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 6 }}
                                    transition={{
                                       type: "spring",
                                       stiffness: 260,
                                       damping: 20,
                                    }}
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
                     )}

                     {/* Previews moved outside item wrapper to only appear when icon is hovered, not the preview itself */}
                  </div>
               );
            })}
            {/* Desktop: Global hover previews anchored to dock center */}
            {!isMobile && (
            <>
            <AnimatePresence>
               {terminalState.minimized && hovered === "terminal" && (
                  <motion.div
                     initial={{ opacity: 0, y: 12, scale: 0.96 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: 12, scale: 0.96 }}
                     transition={{ type: "spring", stiffness: 260, damping: 22 }}
                     className="absolute -top-[16rem] left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                  >
                     <div className="w-[420px] h-[240px] rounded-2xl border border-white/15 bg-slate-900/95 shadow-2xl overflow-hidden relative">
                        <div
                           className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                           style={{
                              width: 768,
                              height: 384,
                              transform: "scale(0.55)",
                              transformOrigin: "center",
                           }}
                        >
                           <div className="h-full w-full font-mono text-left">
                              <TerminalHeader isFullscreen={false} showClock={false} />
                              <div className="h-[calc(100%-3rem)] overflow-hidden">
                                 <HSMTerminalBody
                                    inputRef={previewInputRef}
                                    containerRef={previewContainerRef}
                                 />
                              </div>
                           </div>
                        </div>
                     </div>
                  </motion.div>
               )}
            </AnimatePresence>

            <AnimatePresence>
               {docsState.minimized && hovered === "pricing" && (
                  <motion.div
                     initial={{ opacity: 0, y: 12, scale: 0.96 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: 12, scale: 0.96 }}
                     transition={{ type: "spring", stiffness: 260, damping: 22 }}
                     className="absolute -top-[20rem] left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                  >
                     <div className="w-[420px] h-[300px] rounded-2xl border border-white/15 bg-slate-900/95 shadow-2xl overflow-hidden relative">
                        <div
                           className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2"
                           style={{
                              width: 768,
                              height: 448,
                              transform: "scale(0.55)",
                              transformOrigin: "center",
                           }}
                        >
                           <div className="h-full w-full font-mono text-left">
                              <TerminalHeader isFullscreen={false} showClock={false} />
                              <div className="h-[calc(100%-3rem)] overflow-hidden">
                                 <NotesApp />
                              </div>
                           </div>
                        </div>
                     </div>
                  </motion.div>
               )}
            </AnimatePresence>

            <AnimatePresence>
               {profileState.minimized && hovered === "profile" && (
                  <motion.div
                     initial={{ opacity: 0, y: 12, scale: 0.96 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: 12, scale: 0.96 }}
                     transition={{ type: "spring", stiffness: 260, damping: 22 }}
                     className="absolute -top-[16rem] left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                  >
                     <div className="w-[420px] h-[240px] rounded-2xl border border-white/15 bg-slate-900/95 shadow-2xl overflow-hidden relative">
                        <div
                           className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                           style={{
                              width: 768,
                              height: 448,
                              transform: "scale(0.55)",
                              transformOrigin: "center",
                           }}
                        >
                           <div className="h-full w-full font-mono text-left">
                              <ProfilePreview />
                           </div>
                        </div>
                     </div>
                  </motion.div>
               )}
            </AnimatePresence>
            </>
            )}
         </nav>
      </div>
   );
}
