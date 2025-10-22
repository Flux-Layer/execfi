'use client';

import clsx from 'clsx';
import type { Dispatch, SetStateAction } from 'react';
import { BASE_MULTIPLIER, PRESET_MULTIPLIERS, requiredBetForMultiplier } from '@/lib/games/coinflip/config';

type CoinFlipMultiplierControlsProps = {
  betValue: number;
  isFlipping: boolean;
  isCustomMultiplier: boolean;
  setIsCustomMultiplier: Dispatch<SetStateAction<boolean>>;
  selectedMultiplier: number;
  setSelectedMultiplier: Dispatch<SetStateAction<number>>;
  customMultiplierInput: string;
  setCustomMultiplierInput: Dispatch<SetStateAction<string>>;
  activeMultiplier: number;
  formatMultiplier: (value: number) => string;
  highestAllowedPreset: number | null;
  multiplierError: string | null;
  potentialPayout: number | null;
  formatEth: (value: number) => string;
};

export function CoinFlipMultiplierControls({
  betValue,
  isFlipping,
  isCustomMultiplier,
  setIsCustomMultiplier,
  selectedMultiplier,
  setSelectedMultiplier,
  customMultiplierInput,
  setCustomMultiplierInput,
  activeMultiplier,
  formatMultiplier,
  highestAllowedPreset,
  multiplierError,
  potentialPayout,
  formatEth,
}: CoinFlipMultiplierControlsProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.3em] text-slate-400">
        <span>Multiplier</span>
        {Number.isFinite(activeMultiplier) && requiredBetForMultiplier(activeMultiplier) ? (
          <span className="text-[10px] text-slate-500">
            Min bet x{formatMultiplier(activeMultiplier)}: {requiredBetForMultiplier(activeMultiplier).toFixed(3)} ETH
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {PRESET_MULTIPLIERS.map((multiplier) => {
          const allowed = Number.isFinite(betValue) && betValue >= requiredBetForMultiplier(multiplier);
          const isActive = !isCustomMultiplier && selectedMultiplier === multiplier;
          const minBetLabel = `Requires bet ≥ ${requiredBetForMultiplier(multiplier).toFixed(3)} ETH`;
          return (
            <div key={multiplier} className="group relative inline-block">
              <button
                type="button"
                onClick={() => {
                  setIsCustomMultiplier(false);
                  setSelectedMultiplier(multiplier);
                  setCustomMultiplierInput('');
                }}
                disabled={!allowed || isFlipping}
                aria-pressed={isActive}
                aria-label={allowed ? `Multiplier x${multiplier}` : minBetLabel}
                className={clsx(
                  'rounded-full border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
                  isActive
                    ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.35)]'
                    : allowed
                    ? 'border-white/10 bg-white/5 text-slate-200 hover:border-emerald-400/50 hover:text-emerald-200'
                    : 'border-white/5 bg-slate-900/60 text-slate-500',
                )}
              >
                x{multiplier}
              </button>
              {!allowed ? (
                <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-slate-950/90 px-3 py-1 text-[10px] font-medium text-slate-200 opacity-0 transition duration-150 group-hover:opacity-100">
                  {minBetLabel}
                </div>
              ) : null}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setIsCustomMultiplier(true);
            setCustomMultiplierInput((prev) => {
              if (prev.trim().length > 0) return prev;
              if (Number.isFinite(activeMultiplier) && !isCustomMultiplier) {
                return formatMultiplier(activeMultiplier);
              }
              const fallback = highestAllowedPreset ?? PRESET_MULTIPLIERS[PRESET_MULTIPLIERS.length - 1];
              return formatMultiplier(fallback);
            });
          }}
          aria-pressed={isCustomMultiplier}
          className={clsx(
            'rounded-full border px-4 py-2 text-sm font-medium transition',
            isCustomMultiplier
              ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.35)]'
              : 'border-white/10 bg-white/5 text-slate-200 hover:border-emerald-400/50 hover:text-emerald-200',
          )}
        >
          Custom
        </button>
      </div>
      {isCustomMultiplier && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-400">x</span>
          <input
            type="number"
            min={BASE_MULTIPLIER}
            step="0.5"
            inputMode="decimal"
            value={customMultiplierInput}
            onChange={(event) => setCustomMultiplierInput(event.target.value)}
            className="w-full flex-1 bg-transparent text-sm text-slate-100 outline-none"
            placeholder="10"
          />
          <button
            type="button"
            onClick={() => {
              setIsCustomMultiplier(false);
              setCustomMultiplierInput('');
              const fallback = highestAllowedPreset ?? PRESET_MULTIPLIERS[0];
              setSelectedMultiplier(fallback);
            }}
            className="rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-300 transition hover:border-emerald-400/50 hover:text-emerald-200"
          >
            Preset
          </button>
        </div>
      )}
      {multiplierError ? (
        <p className="mt-2 text-xs text-rose-400">{multiplierError}</p>
      ) : (
        <p className="mt-2 text-[11px] text-slate-400">
          Active multiplier:
          {Number.isFinite(activeMultiplier) ? ` x${formatMultiplier(activeMultiplier)}` : ' —'}
        </p>
      )}
      {potentialPayout && (
        <p className="text-[11px] text-emerald-200">Potential payout: {formatEth(potentialPayout)} ETH</p>
      )}
    </section>
  );
}
