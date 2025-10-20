"use client";

export function AccessibilityTab() {
  return (
    <div className="space-y-6 p-6">
      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Motion & Animation</h3>
        <label className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-300">Reduce Motion</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Minimize animations and transitions (recommended for vestibular disorders)
            </div>
          </div>
          <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-700">
            <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
          </button>
        </label>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Visual</h3>
        <label className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-300">High Contrast Mode</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Increase contrast for better readability
            </div>
          </div>
          <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-700">
            <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
          </button>
        </label>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Screen Reader</h3>
        <label className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium text-slate-300">Enhanced Screen Reader Support</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Add extra ARIA labels and descriptions
            </div>
          </div>
          <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-700">
            <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
          </button>
        </label>
        <div className="mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <p className="text-xs text-blue-200">
            Tip: Use Tab key to navigate, Enter/Space to activate, and Esc to close windows
          </p>
        </div>
      </section>
    </div>
  );
}
