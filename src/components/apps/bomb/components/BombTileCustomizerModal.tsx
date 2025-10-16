"use client";

import { FiX } from "react-icons/fi";
import {
  BOMBS_PER_ROW,
  MAX_TILE_OPTION,
  MAX_TOTAL_MULTIPLIER,
  MIN_TILE_OPTION,
} from "../config";
import { formatMultiplier } from "../utils";

type BombTileCustomizerModalProps = {
  open: boolean;
  pendingRange: { min: number; max: number };
  adjustPendingRange: (key: "min" | "max", delta: number) => void;
  projectedMaxMultiplier: number;
  onApply: () => Promise<void>;
  onUseDefault: () => Promise<void>;
  onClose: () => void;
  isBuildingRound: boolean;
};

export function BombTileCustomizerModal({
  open,
  pendingRange,
  adjustPendingRange,
  projectedMaxMultiplier,
  onApply,
  onUseDefault,
  onClose,
  isBuildingRound,
}: BombTileCustomizerModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-950/95 p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Customize tiles</h2>
            <p className="mt-2 text-xs text-slate-400">
              Fewer tiles means higher multipliers per row. More tiles reduce risk but lower the reward.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:border-slate-500 hover:text-white"
            aria-label="Close"
          >
            <FiX className="text-base" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {(["min", "max"] as Array<"min" | "max">).map((key) => {
            const label = key === "min" ? "MIN number of tiles" : "MAX number of tiles";
            const value = key === "min" ? pendingRange.min : pendingRange.max;
            const decrementDisabled =
              key === "min" ? value <= MIN_TILE_OPTION : value <= pendingRange.min;
            const incrementDisabled =
              key === "min"
                ? value >= pendingRange.max || value >= MAX_TILE_OPTION
                : value >= MAX_TILE_OPTION;
            return (
              <div
                key={key}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-center"
              >
                <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => adjustPendingRange(key, -1)}
                    disabled={decrementDisabled}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-200 disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="text-lg font-semibold text-slate-100">{value}</span>
                  <button
                    type="button"
                    onClick={() => adjustPendingRange(key, 1)}
                    disabled={incrementDisabled}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-200 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-900 bg-slate-950/80 px-4 py-3 text-[11px] text-slate-300">
          <div>
            Projected row multiplier (cap {formatMultiplier(MAX_TOTAL_MULTIPLIER)}):{" "}
            <span className="font-semibold text-emerald-300">
              {formatMultiplier(projectedMaxMultiplier)}
            </span>
          </div>
          <div className="mt-1 text-slate-500">
            Based on the riskiest configuration ({pendingRange.min} tiles · {BOMBS_PER_ROW} bomb).
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              void onUseDefault();
            }}
            disabled={isBuildingRound}
            className="rounded-full border border-white/10 px-5 py-2 text-xs font-medium text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-200 disabled:opacity-60"
          >
            Use default range
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-5 py-2 text-xs font-medium text-slate-300 transition hover:border-red-400/40 hover:text-red-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void onApply();
            }}
            disabled={isBuildingRound}
            className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-5 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-60"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
