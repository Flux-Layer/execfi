"use client";

import { FiMoon, FiSun, FiMonitor } from "react-icons/fi";

export function AppearanceTab() {
  return (
    <div className="space-y-6 p-6">
      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Theme</h3>
        <div className="grid grid-cols-3 gap-3">
          <button className="flex flex-col items-center gap-2 p-4 rounded-xl border border-emerald-500 bg-emerald-500/10 text-emerald-200">
            <FiMoon className="text-2xl" />
            <span className="text-sm font-medium">Dark</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/10 bg-slate-800/40 text-slate-300 hover:bg-slate-800/60">
            <FiSun className="text-2xl" />
            <span className="text-sm font-medium">Light</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/10 bg-slate-800/40 text-slate-300 hover:bg-slate-800/60">
            <FiMonitor className="text-2xl" />
            <span className="text-sm font-medium">Auto</span>
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Auto mode syncs with your system preferences
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Typography</h3>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Font Size
          </label>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400">A</span>
            <input
              type="range"
              min="12"
              max="20"
              defaultValue="14"
              className="flex-1"
            />
            <span className="text-xl text-slate-400">A</span>
          </div>
          <div className="mt-2 text-center">
            <span className="text-xs text-slate-400">Current: 14px</span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Animations</h3>
        <label className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-300">Enable Animations</div>
            <div className="text-xs text-slate-400 mt-0.5">Window transitions, hover effects, loading states</div>
          </div>
          <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-emerald-500">
            <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
          </button>
        </label>
      </section>
    </div>
  );
}
