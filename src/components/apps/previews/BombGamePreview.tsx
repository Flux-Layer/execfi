"use client";

export default function BombGamePreview() {
  return (
    <div className="flex h-full flex-col bg-slate-950/90 p-4 text-slate-200">
      <header className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-emerald-300/80">
        <span>Degen Shooter</span>
        <span>Preview</span>
      </header>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-2">
          <p className="text-[9px] uppercase tracking-wide text-emerald-200/80">Win Streak</p>
          <p className="text-lg font-semibold text-emerald-100">3</p>
        </div>
        <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 p-2">
          <p className="text-[9px] uppercase tracking-wide text-sky-200/80">Best Multiplier</p>
          <p className="text-lg font-semibold text-sky-100">4.2x</p>
        </div>
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-2">
          <p className="text-[9px] uppercase tracking-wide text-amber-200/80">Balance</p>
          <p className="text-lg font-semibold text-amber-100">1.24 ETH</p>
        </div>
      </div>
      <div className="mt-4 flex-1 rounded-xl border border-white/10 bg-slate-900/80 p-3">
        <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400">Active Round</p>
        <div className="mt-3 grid grid-cols-5 gap-1">
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="aspect-square rounded-md bg-slate-800/90"
            />
          ))}
        </div>
      </div>
      <footer className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
        <span>Next payout: 0.45 ETH</span>
        <span className="text-slate-400">Tap to resume</span>
      </footer>
    </div>
  );
}
