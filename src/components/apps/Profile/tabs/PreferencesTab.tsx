"use client";

import { useState } from "react";
import { useChainSelection } from "@/hooks/useChainSelection";
import { useProfileContext } from "../ProfileContext";
import { useSlippage } from "@/hooks/useSlippage";
import { 
  SLIPPAGE_PRESETS, 
  decimalToSlippage, 
  slippageToDecimal,
  getSlippageWarning,
  getSlippageWarningMessage 
} from "@/lib/utils/slippage";

export function PreferencesTab() {
  const { chain } = useProfileContext();
  const { availableChains, switchChain, isLoading, lastSwitchError } = useChainSelection();
  const { slippage, updateSlippage, resetSlippage, isLoading: slippageLoading } = useSlippage();
  
  const [pendingChain, setPendingChain] = useState<number>(chain.id);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [slippageInput, setSlippageInput] = useState<string>(decimalToSlippage(slippage).toFixed(2));

  const handleApply = async () => {
    setStatusMessage(null);
    if (pendingChain === chain.id) return;
    const ok = await switchChain(pendingChain);
    setStatusMessage(ok ? "Default chain updated" : "Could not switch chain. Check wallet support.");
  };

  const handleSlippageChange = (value: string) => {
    setSlippageInput(value);
  };

  const applySlippage = () => {
    const numValue = parseFloat(slippageInput);
    if (!isNaN(numValue)) {
      const decimal = slippageToDecimal(numValue);
      updateSlippage(decimal);
    }
  };

  const setPreset = (preset: number) => {
    updateSlippage(preset);
    setSlippageInput(decimalToSlippage(preset).toFixed(2));
  };

  const warning = getSlippageWarning(slippage);
  const warningMessage = getSlippageWarningMessage(slippage);

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <header className="mb-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Default Chain</p>
          <h3 className="text-lg font-semibold text-slate-100">{chain.name}</h3>
        </header>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <select
            value={pendingChain}
            onChange={(event) => setPendingChain(Number(event.target.value))}
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-slate-100 md:max-w-sm"
          >
            {availableChains.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} (ID {candidate.id})
              </option>
            ))}
          </select>
          <button
            onClick={handleApply}
            disabled={isLoading || pendingChain === chain.id}
            className="rounded-xl border border-emerald-500/50 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading ? "Switching…" : "Set as default"}
          </button>
        </div>
        {statusMessage && <p className="mt-2 text-sm text-emerald-300">{statusMessage}</p>}
        {lastSwitchError && <p className="mt-2 text-sm text-rose-300">{lastSwitchError}</p>}
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <header className="mb-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Transaction Settings</p>
          <h3 className="text-lg font-semibold text-slate-100">Slippage Tolerance</h3>
          <p className="mt-1 text-xs text-slate-400">
            Maximum price movement you&apos;re willing to accept during swaps and bridges
          </p>
        </header>

        <div className="space-y-4">
          {/* Preset buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPreset(SLIPPAGE_PRESETS.VERY_LOW)}
              disabled={slippageLoading}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                Math.abs(slippage - SLIPPAGE_PRESETS.VERY_LOW) < 0.0001
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                  : 'border-white/10 text-slate-300 hover:bg-white/5'
              }`}
            >
              0.05%
            </button>
            <button
              onClick={() => setPreset(SLIPPAGE_PRESETS.LOW)}
              disabled={slippageLoading}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                Math.abs(slippage - SLIPPAGE_PRESETS.LOW) < 0.0001
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                  : 'border-white/10 text-slate-300 hover:bg-white/5'
              }`}
            >
              0.1%
            </button>
            <button
              onClick={() => setPreset(SLIPPAGE_PRESETS.MEDIUM)}
              disabled={slippageLoading}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                Math.abs(slippage - SLIPPAGE_PRESETS.MEDIUM) < 0.0001
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                  : 'border-white/10 text-slate-300 hover:bg-white/5'
              }`}
            >
              0.5%
            </button>
            <button
              onClick={() => setPreset(SLIPPAGE_PRESETS.HIGH)}
              disabled={slippageLoading}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                Math.abs(slippage - SLIPPAGE_PRESETS.HIGH) < 0.0001
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                  : 'border-white/10 text-slate-300 hover:bg-white/5'
              }`}
            >
              1%
            </button>
          </div>

          {/* Custom input */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="number"
                min="0.01"
                max="99"
                step="0.01"
                value={slippageInput}
                onChange={(e) => handleSlippageChange(e.target.value)}
                onBlur={applySlippage}
                onKeyDown={(e) => e.key === 'Enter' && applySlippage()}
                disabled={slippageLoading}
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 pr-8 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                placeholder="Custom slippage"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
            </div>
            <button
              onClick={resetSlippage}
              disabled={slippageLoading}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reset
            </button>
          </div>

          {/* Warning messages */}
          {warningMessage && (
            <div className={`rounded-lg p-3 text-sm ${
              warning === 'high' 
                ? 'bg-amber-500/10 text-amber-200 border border-amber-500/20' 
                : 'bg-yellow-500/10 text-yellow-200 border border-yellow-500/20'
            }`}>
              {warningMessage}
            </div>
          )}

          {/* Current value display */}
          <div className="text-xs text-slate-400">
            Current: <span className="font-mono text-emerald-300">{(slippage * 100).toFixed(2)}%</span>
            <span className="text-slate-500"> • Valid range: 0.01% - 99%</span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <header className="mb-2">
          <p className="text-xs uppercase tracking-wider text-slate-400">Notifications</p>
        </header>
        <p className="text-sm text-slate-400">
          Notification preferences will be configurable once the notification service is available.
        </p>
      </section>
    </div>
  );
}
