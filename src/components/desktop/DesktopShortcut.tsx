"use client";

import type { ReactNode } from "react";
import clsx from "clsx";

type DesktopShortcutProps = {
   icon: ReactNode;
   label: string;
   onActivate?: () => void;
   className?: string;
};

/**
 * Desktop-style shortcut button for launching floating apps from the home screen.
 */
export default function DesktopShortcut({
   icon,
   label,
   onActivate,
   className,
}: DesktopShortcutProps) {
   return (
      <button
         type="button"
         onClick={onActivate}
         className={clsx(
            "group pointer-events-auto flex w-24 flex-col items-center gap-2 rounded-2xl bg-none p-3 text-slate-200 transition",
            "backdrop-blur hover:border-emerald-400/60 hover:bg-slate-900/40 focus-visible:outline-2 focus-visible:outline-emerald-400/70",
            className,
         )}
      >
         <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/70 shadow-inner text-xl text-rose-300 group-hover:text-rose-200">
            {icon}
         </span>
         <span className="text-xs font-medium tracking-wide text-slate-100 group-hover:text-emerald-200">
            {label}
         </span>
      </button>
   );
}
