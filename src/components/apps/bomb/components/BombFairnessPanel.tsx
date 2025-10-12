"use client";

import type { FairnessState, GameStatus, RowLayout, RowMultiplierStat } from "../types";
import type { VerificationRowOutput } from "../useBombGameState";
import { formatMultiplier } from "../utils";

type BombFairnessPanelProps = {
  status: GameStatus;
  isBuildingRound: boolean;
  rerollTiles: () => Promise<void>;
  txHashInput: string;
  setTxHashInput: (value: string) => void;
  txHashVerified: boolean;
  revealFairness: () => Promise<void>;
  verifyRound: () => Promise<void>;
  isVerifying: boolean;
  fairnessState: FairnessState | null;
  rows: RowLayout[];
  rowStats: RowMultiplierStat[];
  verificationStatus: "idle" | "valid" | "invalid" | "error";
  verificationOutput: VerificationRowOutput[] | null;
};

export function BombFairnessPanel({
  status,
  isBuildingRound,
  rerollTiles,
  txHashInput,
  setTxHashInput,
  txHashVerified,
  revealFairness,
  verifyRound,
  isVerifying,
  fairnessState,
  rows,
  rowStats,
  verificationStatus,
  verificationOutput,
}: BombFairnessPanelProps) {
  if (status === "idle") return null;

  return (
    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-emerald-300">Provably Fair Verification</div>
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
      </div>

      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
        <input
          value={txHashInput}
          onChange={(event) => setTxHashInput(event.target.value)}
          spellCheck={false}
          placeholder="Tempel TX hash ronde ini untuk membuka data fairness"
          disabled={txHashVerified || isBuildingRound}
          className="flex-1 rounded border border-slate-800 bg-slate-950/60 px-3 py-2 font-mono text-[11px] text-slate-200 outline-none focus:border-emerald-500/60 disabled:opacity-60"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              void revealFairness();
            }}
            disabled={txHashVerified || isBuildingRound || !txHashInput.trim()}
            className="rounded border border-emerald-500/40 px-3 py-1.5 text-[11px] font-medium text-emerald-200 transition hover:border-emerald-400/70 hover:text-emerald-100 disabled:opacity-60"
          >
            {txHashVerified ? "Fairness revealed" : "Reveal Fairness"}
          </button>
          <button
            type="button"
            onClick={() => {
              void verifyRound();
            }}
            disabled={
              !txHashVerified ||
              isVerifying ||
              isBuildingRound ||
              !fairnessState ||
              !fairnessState.rowsMeta.length
            }
            className="rounded border border-white/10 px-3 py-1.5 text-[11px] font-medium text-slate-200 transition hover:border-emerald-400/40 hover:text-emerald-200 disabled:opacity-60"
          >
            {isVerifying ? "Verifying..." : "Verify Hashes"}
          </button>
        </div>
      </div>

      {!txHashVerified ? (
        <p className="mt-3 text-[11px] text-slate-400">
          Paste the execution TX hash to reveal the server/client seeds and verify the distribution. The data becomes
          available once a hash is provided.
        </p>
      ) : (
        <>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Server Seed Hash (commit)</div>
              <code className="mt-1 block truncate rounded bg-slate-950/70 px-3 py-2 font-mono text-[11px] text-emerald-200">
                {fairnessState?.serverSeedHash ?? "—"}
              </code>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Server Seed (reveal)</div>
              <code className="mt-1 block truncate rounded bg-slate-950/70 px-3 py-2 font-mono text-[11px] text-slate-300">
                {fairnessState?.serverSeed ?? "—"}
              </code>
            </div>
          </div>

          <details className="mt-3 rounded-lg border border-slate-800/60 bg-slate-950/60 p-3">
            <summary className="cursor-pointer text-[11px] font-semibold text-emerald-300">
              Round hashes & probabilities
            </summary>
            <div className="mt-2 space-y-2">
              {rows.map((row, idx) => {
                const displayRound = idx + 1;
                const rowStat = rowStats[idx];
                const rowMultiplierDetail =
                  rowStat?.status === "completed"
                    ? formatMultiplier(rowStat.rowMultiplier)
                    : rowStat?.status === "crash"
                    ? formatMultiplier(0)
                    : formatMultiplier(row.fairness.rowMultiplier);
                return (
                  <div
                    key={`fair-row-${row.fairness.rowIndex}`}
                    className="rounded border border-slate-800/50 bg-slate-900/70 p-2"
                  >
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-200">
                      <span>Round #{displayRound} · Nonce {row.fairness.nonce}</span>
                      <span>Tile count {row.fairness.tileCount}</span>
                    </div>
                    <div className="mt-1 break-all font-mono text-[10px] text-slate-400">
                      Hash: {row.fairness.gameHash}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      Bomb probability / tile: {(row.fairness.probabilities[0]?.bomb ?? 0).toFixed(4)} |
                      Safe: {(row.fairness.probabilities[0]?.safe ?? 0).toFixed(4)}
                    </div>
                    {status === "lost" && (
                      <div className="mt-1 text-[10px] text-red-300">
                        Bomb column index: {row.fairness.bombIndex + 1}
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-slate-400">
                      Row multiplier: {rowMultiplierDetail}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      Selected column: {row.selectedColumn !== null ? row.selectedColumn + 1 : "pending"}
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
        </>
      )}
    </div>
  );
}
