"use client";

export default function CoinFlipGamePreview() {
  return (
    <div className="flex h-full flex-col bg-slate-950/90 p-4 text-slate-200">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">CoinFlip</p>
          <p className="text-lg font-semibold text-slate-100">Heads vs Tails</p>
        </div>
        <div className="rounded-full border border-white/10 bg-slate-900/90 px-3 py-1 text-[10px] text-slate-400">
          Preview
        </div>
      </header>
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 p-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-amber-400/30 to-amber-500/40 text-xl font-semibold text-amber-100">
          ₿
        </div>
        <div className="flex-1 text-xs">
          <p className="text-slate-400">Current Bet</p>
          <p className="text-base font-semibold text-slate-100">0.015 ETH</p>
          <p className="text-slate-500">Potential payout 0.028 ETH</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-2">
          <p className="text-[9px] uppercase tracking-wide text-emerald-200/80">Win Rate</p>
          <p className="text-lg font-semibold text-emerald-100">58%</p>
        </div>
        <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 p-2">
          <p className="text-[9px] uppercase tracking-wide text-sky-200/80">Last Result</p>
          <p className="text-lg font-semibold text-sky-100">Heads</p>
        </div>
      </div>
      <div className="mt-3 flex-1 rounded-xl border border-white/10 bg-slate-900/80 p-3">
        <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400">History</p>
        <div className="mt-2 grid grid-cols-5 gap-1 text-[10px]">
          {["H", "T", "H", "H", "T", "T", "H", "H", "T", "H"].map((entry, index) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={`${entry}-${index}`}
              className="flex items-center justify-center rounded-md border border-white/10 bg-slate-800/80 text-slate-300"
            >
              {entry}
            </div>
          ))}
        </div>
      </div>
      <footer className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
        <span>Last played 2m ago</span>
        <span className="text-slate-400">Hover to resume</span>
      </footer>
    </div>
  );
}
