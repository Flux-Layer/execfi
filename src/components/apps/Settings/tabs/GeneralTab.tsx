"use client";

export function GeneralTab() {
  return (
    <div className="space-y-6 p-6">
      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Language & Region</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Interface Language
            </label>
            <select
              className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-slate-100"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="ja">日本語</option>
              <option value="zh">中文</option>
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Language for menus, buttons, and messages
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Date & Time Format
            </label>
            <select
              className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-slate-100"
            >
              <option>MM/DD/YYYY (US)</option>
              <option>DD/MM/YYYY (EU)</option>
              <option>YYYY-MM-DD (ISO)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Currency Display
            </label>
            <select
              className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-slate-100"
            >
              <option>USD ($)</option>
              <option>EUR (€)</option>
              <option>GBP (£)</option>
              <option>JPY (¥)</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}
