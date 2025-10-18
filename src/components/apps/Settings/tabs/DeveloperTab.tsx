"use client";

import { FiAlertTriangle } from "react-icons/fi";
import { APP_INFO } from "@/lib/constants/appInfo";

export function DeveloperTab() {
  return (
    <div className="space-y-6 p-6">
      <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
        <div className="flex items-start gap-3 mb-4">
          <FiAlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-amber-200 mb-1">Developer Options</h3>
            <p className="text-sm text-amber-300/80">
              These settings are intended for developers and advanced users.
              Incorrect configuration may cause unexpected behavior.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Debugging</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-300">Debug Mode</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Enable detailed console logging and error overlays
              </div>
            </div>
            <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-700">
              <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
            </button>
          </label>

          <label className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-300">Verbose Logging</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Log all API requests, state changes, and transactions
              </div>
            </div>
            <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-700">
              <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
            </button>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Network</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40">
            <div>
              <div className="text-sm font-medium text-slate-300">Default Network</div>
              <div className="text-xs text-slate-400 mt-0.5">{APP_INFO.chains.mainnet.name} ({APP_INFO.chains.mainnet.id})</div>
            </div>
            <button className="px-3 py-1.5 rounded-lg border border-amber-500/50 text-sm text-amber-200 hover:bg-amber-500/10 transition">
              Switch to Testnet
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/40">
            <div className="text-sm font-medium text-slate-300 mb-2">Contract Addresses</div>
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">XP Registry:</span>
                <span className="text-emerald-400">{APP_INFO.contracts.xpRegistry.slice(0, 10)}...</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Degenshoot:</span>
                <span className="text-emerald-400">{APP_INFO.contracts.degenshoot.slice(0, 10)}...</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Wager Vault:</span>
                <span className="text-emerald-400">{APP_INFO.contracts.wagerVault.slice(0, 10)}...</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
