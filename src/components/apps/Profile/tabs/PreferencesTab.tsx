"use client";

import { useState } from "react";
import { useChainSelection } from "@/hooks/useChainSelection";
import { useProfileContext } from "../ProfileContext";

export function PreferencesTab() {
  const { chain } = useProfileContext();
  const { availableChains, switchChain, isLoading, lastSwitchError } = useChainSelection();
  const [pendingChain, setPendingChain] = useState<number>(chain.id);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleApply = async () => {
    setStatusMessage(null);
    if (pendingChain === chain.id) return;
    const ok = await switchChain(pendingChain);
    setStatusMessage(ok ? "Default chain updated" : "Could not switch chain. Check wallet support.");
  };

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
