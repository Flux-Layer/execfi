"use client";

import { ReactNode } from "react";
import { FiX } from "react-icons/fi";

export type OverlayModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
};

export default function OverlayModal({ open, title, description, children, onClose }: OverlayModalProps) {
  if (!open) return null;

  return (
    <div className="pointer-events-auto">
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-6"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-xl rounded-3xl border border-emerald-500/40 bg-slate-950 px-6 py-7 text-[11px] text-slate-200 shadow-emerald-500/20"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full border border-slate-700 bg-slate-900/70 p-1 text-slate-400 transition hover:border-emerald-400/40 hover:text-emerald-200"
            aria-label="Close"
          >
            <FiX className="h-4 w-4" />
          </button>
          <h3 className="text-base font-semibold text-emerald-200">{title}</h3>
          {description && <p className="mt-3 text-slate-300">{description}</p>}
          <div className="mt-4 text-slate-300 leading-relaxed">{children}</div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-emerald-500/50 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400 hover:text-emerald-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
