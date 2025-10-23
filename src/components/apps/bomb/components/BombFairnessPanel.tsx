"use client";

import clsx from "clsx";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import type {
  FairnessState,
  GameStatus,
  RowLayout,
  RowMultiplierStat,
  RoundSummary,
} from "../types";
import type { VerificationRowOutput } from "../useBombGameState";
import { formatMultiplier } from "../utils";

type BombFairnessPanelProps = {
  status: GameStatus;
  isBuildingRound: boolean;
  isRevealing: boolean;
  rerollTiles: () => Promise<void>;
  fairnessState: FairnessState | null;
  rows: RowLayout[];
  rowStats: RowMultiplierStat[];
  roundSummary: RoundSummary | null;
  canReveal: boolean;
  revealFairness: () => Promise<void>;
  verifyRound: () => Promise<void>;
  isVerifying: boolean;
  verificationStatus: "idle" | "valid" | "invalid" | "error";
  verificationOutput: VerificationRowOutput[] | null;
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function BombFairnessPanel({
  status,
  isBuildingRound,
  isRevealing,
  rerollTiles,
  fairnessState,
  rows,
  rowStats,
  roundSummary,
  canReveal,
  revealFairness,
  verifyRound,
  isVerifying,
  verificationStatus,
  verificationOutput,
  className,
  isCollapsed = false,
  onToggleCollapse,
}: BombFairnessPanelProps) {
  if (status === "idle" || !fairnessState) return null;

  const revealed = Boolean(fairnessState.revealed && fairnessState.serverSeed);

  // Collapsed view for mobile
  if (isCollapsed) {
    return (
      <div
        className={clsx(
          "mt-2 sm:mt-4 rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-[10px] sm:text-xs text-slate-200 md:hidden",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-emerald-300">Provably Fair</div>
            <span className="text-[10px] text-slate-400">
              {revealed ? "Revealed" : "Hidden"}
            </span>
          </div>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded-lg border border-slate-700 bg-slate-900/80 p-2 text-slate-400 transition hover:border-slate-600 hover:text-slate-300"
              aria-label="Expand fairness panel"
            >
              <FiChevronUp className="text-base" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "mt-2 sm:mt-4 rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4 text-[10px] sm:text-xs text-slate-200",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="text-sm font-semibold text-emerald-300">Provably Fair Verification</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void rerollTiles();
            }}
            disabled={isBuildingRound}
            className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-medium text-slate-200 transition hover:border-emerald-400/40 hover:text-emerald-200 disabled:opacity-60"
          >
            New Round
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="md:hidden rounded-lg border border-slate-700 bg-slate-900/80 p-2 text-slate-400 transition hover:border-slate-600 hover:text-slate-300"
              aria-label="Collapse fairness panel"
            >
              <FiChevronDown className="text-base" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {revealed && (
          <button
            type="button"
            onClick={() => {
              void verifyRound();
            }}
            disabled={!revealed || isVerifying || isBuildingRound}
            className="rounded border border-white/10 px-3 py-1.5 text-[11px] font-medium text-slate-200 transition hover:border-emerald-400/40 hover:text-emerald-200 disabled:opacity-60"
          >
            {isVerifying ? "Verifying..." : "Verify Hashes"}
          </button>
        )}
        {!revealed && isRevealing && (
          <div className="text-[11px] text-emerald-200">Revealing fairness...</div>
        )}
      </div>

      {roundSummary && (
        <div className="mt-3 grid gap-2 rounded-lg border border-slate-800/50 bg-slate-900/60 p-3 text-[11px] text-slate-200 md:grid-cols-3">
          <div>
            <div className="uppercase tracking-wider text-slate-400">XP Award</div>
            <div className="text-emerald-300">{roundSummary.xp}</div>
          </div>
          <div>
            <div className="uppercase tracking-wider text-slate-400">Multiplier</div>
            <div className="text-emerald-300">x{roundSummary.multiplier.toFixed(2)}</div>
          </div>
          <div>
            <div className="uppercase tracking-wider text-slate-400">Rows Completed</div>
            <div className="text-emerald-300">{roundSummary.completedRows}</div>
          </div>
        </div>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Server Seed Hash (commit)</div>
          <code className="mt-1 block truncate rounded bg-slate-950/70 px-3 py-2 font-mono text-[11px] text-emerald-200">
            {fairnessState.serverSeedHash ?? "—"}
          </code>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Server Seed (reveal)</div>
          <code className="mt-1 block truncate rounded bg-slate-950/70 px-3 py-2 font-mono text-[11px] text-slate-300">
            {revealed ? fairnessState.serverSeed ?? "—" : "Hidden until reveal"}
          </code>
        </div>
      </div>

      {!revealed && (
        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
          Server commitment recorded. Finish the round and press Reveal Fairness to view bomb positions.
        </div>
      )}

      <details className="mt-3 rounded-lg border border-slate-800/60 bg-slate-950/60 p-3">
        <summary className="cursor-pointer text-[11px] font-semibold text-emerald-300">
          Round layout & hashes
        </summary>
        <div className="mt-2 space-y-2">
          {fairnessState.rowsMeta.map((meta, idx) => {
            const displayRound = idx + 1;
            const rowStat = rowStats[idx];
            const layoutRow = rows[idx];
            const rowMultiplierDetail =
              rowStat?.status === "completed"
                ? formatMultiplier(rowStat.rowMultiplier)
                : rowStat?.status === "crash"
                ? formatMultiplier(0)
                : formatMultiplier(meta.rowMultiplier);
            const bombIndex = revealed ? meta.bombIndex : -1;
            const bombClass = revealed ? "text-red-300" : "text-slate-500";
            const probability = meta.probabilities?.[0];
            return (
              <div
                key={`fair-row-${meta.rowIndex}`}
                className="rounded border border-slate-800/50 bg-slate-900/70 p-2"
              >
                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-200">
                  <span>Round #{displayRound} · Nonce {meta.nonce}</span>
                  <span>Tile count {meta.tileCount}</span>
                </div>
                <div className="mt-1 break-all font-mono text-[10px] text-slate-400">
                  Hash: {meta.gameHash}
                </div>
                <div className="mt-1 text-[10px] text-slate-400">
                  Bomb probability / tile: {(probability?.bomb ?? 0).toFixed(4)} | Safe: {(probability?.safe ?? 0).toFixed(4)}
                </div>
                <div className={`mt-1 text-[10px] ${bombClass}`}>
                  Bomb column index: {bombIndex >= 0 ? bombIndex + 1 : "Hidden"}
                </div>
                <div className="mt-1 text-[10px] text-slate-400">
                  Row multiplier: {rowMultiplierDetail}
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  Selected column: {layoutRow?.selectedColumn !== null && layoutRow?.selectedColumn !== undefined ? layoutRow.selectedColumn + 1 : "pending"}
                </div>
              </div>
            );
          })}
        </div>
      </details>

      {verificationStatus !== "idle" && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-[11px] ${
            verificationStatus === "valid"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : verificationStatus === "invalid"
              ? "border-red-500/40 bg-red-500/10 text-red-200"
              : "border-amber-500/40 bg-amber-500/10 text-amber-200"
          }`}
        >
          <div className="font-semibold">
            {verificationStatus === "valid"
              ? "Round verified successfully"
              : verificationStatus === "invalid"
              ? "Verification mismatch detected"
              : "Verification failed"}
          </div>
          {verificationOutput && verificationOutput.length > 0 && (
            <div className="mt-1 grid gap-1 text-[10px]">
              {verificationOutput.map((row) => (
                <div key={`verify-${row.rowIndex}`} className="flex justify-between">
                  <span>Round #{rows.length - row.rowIndex}</span>
                  <span>
                    {row.valid
                      ? "valid"
                      : row.recomputedBombIndex >= 0
                      ? `recomputed ${row.recomputedBombIndex + 1}`
                      : "hash mismatch"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
