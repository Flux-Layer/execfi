"use client";

import { forwardRef } from "react";
import { FaBomb } from "react-icons/fa6";
import { BOMBS_PER_ROW, TILE_SIZE_CLASS } from "./config";
import type { RowLayout, RowMultiplierStat, RowStatusView } from "./types";
import { ROW_STATUS_LABELS } from "./types";
import { formatMultiplier, formatMultiplierOrDash } from "./utils";

type BombRowCardProps = {
  layout: RowLayout;
  stat?: RowMultiplierStat;
  originalIndex: number;
  activeRowIndex: number;
  hasStarted: boolean;
  status: "idle" | "lost" | "won";
  onTileSelect: (rowIndex: number, column: number) => void;
};

const activeClass = `${TILE_SIZE_CLASS} flex items-center justify-center rounded-xl border border-slate-700 bg-[radial-gradient(circle_at_top,#3f4c6b,#1f2937)] shadow-emerald-500/10 transition`;
const revealedClass = `${TILE_SIZE_CLASS} flex items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/20 shadow-emerald-500/30 transition`;

export const BombRowCard = forwardRef<HTMLDivElement, BombRowCardProps>(
  ({ layout, stat, originalIndex, activeRowIndex, hasStarted, status, onTileSelect }, ref) => {
    const rowStatus: RowStatusView = stat?.status ?? "locked";
    const statusLabel = ROW_STATUS_LABELS[rowStatus];
    const isCrashRow = rowStatus === "crash";
    const isActiveRow = rowStatus === "active";
    const isCompletedRow = rowStatus === "completed";
    const totalDisplay = isCrashRow ? formatMultiplier(0) : formatMultiplierOrDash(stat?.cumulative);
    const bombsPerRowDisplay = layout.fairness.bombsPerRow ?? BOMBS_PER_ROW;
    const bombColumn =
      layout.fairness.bombIndex >= 0 ? layout.activeColumns[layout.fairness.bombIndex] : null;
    const shouldRevealBomb = status !== "idle";

    const cardStateClass = isCrashRow
      ? "border-red-500/70 bg-slate-950 shadow-red-900/40 text-red-100"
      : isActiveRow
      ? "border-emerald-500/50 bg-slate-950 shadow-emerald-500/30 text-emerald-100"
      : isCompletedRow
      ? "border-slate-800/60 bg-slate-950 text-slate-200"
      : "border-slate-800/40 bg-slate-950 text-slate-400";

    return (
      <div
        ref={ref}
        className={`w-full max-w-3xl rounded-3xl border p-4 shadow-inner shadow-black/40 transition text-left ${cardStateClass}`}
      >
        <div className="mb-3 flex flex-col gap-3 text-xs">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] opacity-70">
            <span>Row {stat?.rowNumber ?? originalIndex + 1}</span>
            <span
              className={`font-medium ${
                isCrashRow ? "text-red-300" : isActiveRow ? "text-emerald-300" : "opacity-70"
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <div className={`text-2xl font-semibold ${isCrashRow ? "text-red-300" : "text-emerald-300"}`}>
            {totalDisplay}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex flex-wrap items-center justify-center gap-4">
            {layout.activeColumns.map((sourceColumn, idx) => {
              const isDisabled =
                !hasStarted || status !== "idle" || originalIndex !== activeRowIndex || layout.selectedColumn !== null;
              const isSelected = layout.selectedColumn === sourceColumn;
              const isBombTile = shouldRevealBomb && sourceColumn === bombColumn;
              const tileClass = isSelected ? revealedClass : activeClass;

              return (
                <button
                  type="button"
                  key={`${originalIndex}-${sourceColumn}`}
                  disabled={isDisabled}
                  onClick={() => onTileSelect(originalIndex, sourceColumn)}
                  className={`${tileClass} ${isBombTile ? "ring-2 ring-red-500/80" : ""}`}
                >
                  {isBombTile && <FaBomb className="h-9 w-9 text-red-400 drop-shadow-md" />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-2 text-[10px] opacity-70">
          {layout.activeColumns.length} tiles · {bombsPerRowDisplay} bomb{bombsPerRowDisplay > 1 ? "s" : ""}
        </div>
      </div>
    );
  }
);

BombRowCard.displayName = "BombRowCard";
