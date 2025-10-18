"use client";

export function PrivacyDataTab() {
  return (
    <div className="space-y-6 p-6">
      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Analytics & Tracking</h3>
        <label className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-300">Anonymous Usage Analytics</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Help improve ExecFi by sharing anonymous usage data
            </div>
          </div>
          <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-emerald-500">
            <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
          </button>
        </label>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Data Management</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40">
            <div>
              <div className="text-sm font-medium text-slate-300">Export Your Data</div>
              <div className="text-xs text-slate-400 mt-0.5">Download all your data as JSON</div>
            </div>
            <button className="px-3 py-1.5 rounded-lg border border-emerald-500/50 text-sm text-emerald-200 hover:bg-emerald-500/10 transition">
              Export
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40">
            <div>
              <div className="text-sm font-medium text-slate-300">Clear Cache</div>
              <div className="text-xs text-slate-400 mt-0.5">Remove all cached data and temporary files</div>
            </div>
            <button className="px-3 py-1.5 rounded-lg border border-amber-500/50 text-sm text-amber-200 hover:bg-amber-500/10 transition">
              Clear
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40">
            <div>
              <div className="text-sm font-medium text-rose-300">Reset Application</div>
              <div className="text-xs text-slate-400 mt-0.5">Restore all settings to defaults (cannot be undone)</div>
            </div>
            <button className="px-3 py-1.5 rounded-lg border border-rose-500/50 text-sm text-rose-200 hover:bg-rose-500/10 transition">
              Reset
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
