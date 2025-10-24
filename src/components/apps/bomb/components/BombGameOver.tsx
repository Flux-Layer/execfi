"use client";

import { FaBomb } from "react-icons/fa6";

type GameOverModalProps = {
  open: boolean;
  lostRow: number | null;
  onClose: () => void;
};

export function GameOverModal({ open, lostRow, onClose }: GameOverModalProps) {
  if (!open) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-md rounded-3xl border border-red-500/50 bg-slate-950/95 p-8 text-center shadow-2xl shadow-red-900/40">
        <div className="flex justify-center">
          <FaBomb className="h-16 w-16 text-red-400 drop-shadow-lg" />
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-red-200">Game Over</h2>
        <p className="mt-2 text-sm text-slate-300">
          The bomb exploded on round {lostRow !== null ? lostRow + 1 : "-"}.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-400/40 hover:text-slate-200/90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
