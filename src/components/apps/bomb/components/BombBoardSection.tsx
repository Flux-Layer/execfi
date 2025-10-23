"use client";

import { type MutableRefObject, useEffect, useRef } from "react";
import { BombRowCard } from "../BombRowCard";
import type { GameStatus, RowLayout, RowMultiplierStat } from "../types";
import type { SummaryVariant } from "../useBombGameState";
import { BombSummaryCard } from "./BombSummaryCard";

type BombBoardSectionProps = {
  rowsForRender: Array<{ row: RowLayout; originalIndex: number }>;
  rowRefs: MutableRefObject<Array<HTMLDivElement | null>>;
  rowStats: RowMultiplierStat[];
  activeRowIndex: number;
  hasStarted: boolean;
  status: GameStatus;
  onTileSelect: (rowIndex: number, column: number) => void;
  summary: {
    title: string;
    variant: SummaryVariant;
    multiplier: number;
    potentialPayout: number | null;
    hasStarted: boolean;
    betAmount: number | null;
  };
};

export function BombBoardSection({
  rowsForRender,
  rowRefs,
  rowStats,
  activeRowIndex,
  hasStarted,
  status,
  onTileSelect,
  summary,
}: BombBoardSectionProps) {
  return (
    <div className="flex-1 overflow-auto px-1 py-2 sm:px-4 sm:py-4 md:px-6 md:py-6">
      <div className="flex flex-col items-center gap-3 pb-3 sm:gap-4 sm:pb-4 md:gap-5">
        {rowsForRender.length === 0 ? (
          <div className="flex h-32 w-full max-w-3xl items-center justify-center text-[10px] sm:text-xs text-slate-400">
            Initialising provably fair round...
          </div>
        ) : (
          rowsForRender.map(({ row, originalIndex }) => (
            <BombRowCard
              key={`row-${originalIndex}`}
              ref={(el) => {
                rowRefs.current[originalIndex] = el;
              }}
              layout={row}
              stat={rowStats[originalIndex]}
              originalIndex={originalIndex}
              activeRowIndex={activeRowIndex}
              hasStarted={hasStarted}
              status={status}
              onTileSelect={onTileSelect}
            />
          ))
        )}

        <BombSummaryCard
          title={summary.title}
          variant={summary.variant}
          multiplier={summary.multiplier}
          potentialPayout={summary.potentialPayout}
          hasStarted={summary.hasStarted}
          betAmount={summary.betAmount}
        />
      </div>
    </div>
  );
}
