"use client";

import { useProfileContext } from "../ProfileContext";

export function SecurityTab() {
  const { authenticated, identity } = useProfileContext();

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <header className="mb-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Session status</p>
          <h3 className="text-lg font-semibold text-slate-100">{authenticated ? "Active session" : "Signed out"}</h3>
        </header>
        <p className="text-sm text-slate-400">
          {authenticated
            ? "Your current session is authenticated through Privy. Session management controls will surface here once Privy exposes device metadata."
            : "Sign in through Privy to unlock full ExecFi functionality."}
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6">
        <header className="mb-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Recommendations</p>
        </header>
        <ul className="space-y-3 text-sm text-slate-300">
          <li className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
            Enable MFA on your Privy account to protect linked wallets.
          </li>
          <li className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
            Review spending policies regularly to ensure limits match your risk tolerance.
          </li>
          {identity.email && (
            <li className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              Confirm authentication emails from Privy arrive at {identity.email}.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
