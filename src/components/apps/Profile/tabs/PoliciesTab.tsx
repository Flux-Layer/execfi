"use client";

import { useMemo } from "react";
import { POLICY_PRESETS } from "@/lib/policy/presets";
import { useProfileContext } from "../ProfileContext";

function formatEth(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH`;
}

export function PoliciesTab() {
  const { policy, resetPolicy } = useProfileContext();

  const presetConfig = useMemo(() => POLICY_PRESETS[policy.metadata.preset] ?? null, [policy.metadata.preset]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(policy, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `execfi-policy-${policy.metadata.preset}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <header className="mb-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Active Preset</p>
          <h3 className="text-xl font-semibold text-slate-100">{policy.metadata.preset.toUpperCase()}</h3>
          <p className="text-xs text-slate-500">Version {policy.metadata.version} • Updated {new Date(policy.metadata.lastModified).toLocaleString()}</p>
        </header>
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="rounded-xl border border-white/20 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
          >
            Export JSON
          </button>
          <button
            onClick={() => resetPolicy(policy.metadata.preset)}
            className="rounded-xl border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/10"
          >
            Reset preset
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Max Transaction Amount</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{formatEth(policy.config.maxTxAmountETH)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Daily Limit</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{formatEth(policy.config.dailyLimitETH)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Min Balance After Tx</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{formatEth(policy.config.minBalanceAfterTxETH)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Max Transactions Per Day</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{policy.config.maxTxPerDay}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <header className="mb-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Preset Overview</p>
          <h4 className="text-lg font-semibold text-slate-100">
            {presetConfig ? "Preset defaults" : "Custom configuration"}
          </h4>
        </header>
        {presetConfig ? (
          <dl className="grid gap-4 md:grid-cols-2">
            {Object.entries(presetConfig).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                <dt className="text-xs uppercase tracking-wide text-slate-400">{key}</dt>
                <dd className="mt-1 text-sm text-slate-100">{typeof value === "number" ? value.toString() : JSON.stringify(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-slate-400">
            Configuration differs from built-in presets. Editing capabilities will arrive in a follow-up iteration.
          </p>
        )}
      </section>
    </div>
  );
}
