'use client';

type CoinFlipNetworkGateProps = {
  visible: boolean;
  targetChainLabel: string;
  onSwitchNetwork: () => void;
};

export function CoinFlipNetworkGate({ visible, targetChainLabel, onSwitchNetwork }: CoinFlipNetworkGateProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 backdrop-blur">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950/95 p-6 text-center text-slate-100 shadow-2xl">
        <h2 className="text-lg font-semibold">Switch Network</h2>
        <p className="mt-3 text-sm text-slate-300">Connect to {targetChainLabel} to play CoinFlip.</p>
        <button
          type="button"
          onClick={onSwitchNetwork}
          className="mt-5 w-full rounded-full border border-emerald-400/60 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/30"
        >
          Switch to {targetChainLabel}
        </button>
        <p className="mt-3 text-xs text-slate-400">You're currently on a different network.</p>
      </div>
    </div>
  );
}
