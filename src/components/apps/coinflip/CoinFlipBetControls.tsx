'use client';

import { MIN_BET } from '@/lib/games/coinflip/config';

type CoinFlipBetControlsProps = {
  betInput: string;
  onBetInputChange: (value: string) => void;
  onResetBet: () => void;
  betError: string | null;
  allowedPresetMultipliers: number[];
};

export function CoinFlipBetControls({
  betInput,
  onBetInputChange,
  onResetBet,
  betError,
  allowedPresetMultipliers,
}: CoinFlipBetControlsProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 sm:p-5">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-slate-400">
        <span>Bet Amount</span>
        <span>Min {MIN_BET.toFixed(3)} ETH</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          min={MIN_BET}
          step="0.0001"
          inputMode="decimal"
          value={betInput}
          onChange={(event) => onBetInputChange(event.target.value)}
          className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-400/40 transition focus:border-emerald-400/60 focus:ring-2"
          placeholder="0.001"
        />
        <button
          type="button"
          onClick={onResetBet}
          className="rounded-xl border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/20"
        >
          Min
        </button>
      </div>
      {betError ? (
        <p className="mt-2 text-xs text-rose-400">{betError}</p>
      ) : (
        <p className="mt-2 text-[11px] text-slate-400">
          Available presets:{' '}
          {allowedPresetMultipliers.length
            ? allowedPresetMultipliers.map((m) => `x${m}`).join(', ')
            : 'Adjust your bet to unlock multipliers'}
        </p>
      )}
      <p className="mt-1 text-[11px] text-slate-500">
        Use up to 6 decimal places for precise ETH readings.
      </p>
    </section>
  );
}
