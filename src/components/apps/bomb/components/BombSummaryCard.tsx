"use client";

import { formatMultiplier } from "../utils";
import type { SummaryVariant } from "../useBombGameState";

type BombSummaryCardProps = {
  title: string;
  variant: SummaryVariant;
  carryIn: number;
  potentialPayout: number | null;
  hasStarted: boolean;
  betAmount: number | null;
};

export function BombSummaryCard({
  title,
  variant,
  carryIn,
  potentialPayout,
  hasStarted,
  betAmount,
}: BombSummaryCardProps) {
  const isLoss = variant === "lost";
  const containerClass = isLoss
    ? "border-red-500/60 bg-slate-950 text-red-100"
    : "border-emerald-500/40 bg-slate-950 text-slate-200";
  const valueClass = isLoss ? "text-red-300" : "text-emerald-300";

  return (
    <div className="sticky bottom-0 z-10 flex w-full justify-center">
      <div className={`w-full max-w-3xl rounded-2xl border px-4 py-4 text-[11px] ${containerClass}`}>
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>{title}</span>
          {hasStarted && betAmount && (
            <span className="text-[11px] text-slate-400">Bet: {betAmount.toFixed(4)} ETH</span>
          )}
        </div>
        <div className="mt-3 text-center">
          <div className={`text-3xl font-semibold ${valueClass}`}>{formatMultiplier(carryIn)}</div>
          {potentialPayout !== null && (
            <div className="mt-2 text-[11px] text-slate-400">≈ {potentialPayout.toFixed(4)} ETH</div>
          )}
        </div>
      </div>
    </div>
  );
}
