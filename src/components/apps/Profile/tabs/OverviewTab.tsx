"use client";

import useUserXp from "@/hooks/useUserXp";
import { useProfileContext } from "../ProfileContext";

export function OverviewTab() {
  const {
    identity,
    authenticated,
    loading,
    smartAccount,
    chain,
    policy,
    activity,
    formatAddress,
    selectedEoa,
  } = useProfileContext();

  const xpAddress = (selectedEoa?.address ?? smartAccount.address) as `0x${string}` | undefined;
  const xpAddressLabel = xpAddress ? formatAddress(xpAddress) : null;
  const userXp = useUserXp({ address: xpAddress });

  const lastActivity = activity[0];

  return (
    <div className="space-y-6 p-6">
      <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-inner shadow-black/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-400">Identity</p>
            <h2 className="text-2xl font-semibold text-slate-100">
              {identity.email ?? identity.userId ?? "Guest"}
            </h2>
            <p className="text-sm text-slate-400">
              {authenticated ? "Authenticated via Privy" : loading ? "Checking session…" : "Not signed in"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm uppercase tracking-wide text-slate-400">Active Chain</p>
            <p className="text-lg font-semibold text-slate-100">{chain.name}</p>
            <p className="text-xs text-slate-500">ID {chain.id}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Smart Account</p>
          <p className="mt-2 text-sm font-semibold text-slate-100">
            {smartAccount.ready && smartAccount.address ? formatAddress(smartAccount.address) : "Initializing…"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Policy Preset</p>
          <p className="mt-2 text-sm font-semibold text-slate-100">{policy.metadata.preset}</p>
          <p className="text-xs text-slate-500">Last updated {new Date(policy.metadata.lastModified).toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Latest Activity</p>
          {lastActivity ? (
            <div className="mt-2 space-y-1 text-sm text-slate-100">
              <p className="font-semibold capitalize">{lastActivity.status}</p>
              <p className="text-xs text-slate-400">{new Date(lastActivity.timestamp).toLocaleString()}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No activity yet</p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Degen Shooter XP</p>
          {!userXp.hasRegistry ? (
            <p className="mt-2 text-sm text-slate-500">XP registry address not configured</p>
          ) : !userXp.enabled ? (
            <p className="mt-2 text-sm text-slate-500">Connect a wallet to track your XP</p>
          ) : userXp.isLoading ? (
            <p className="mt-2 text-sm text-slate-400">Loading XP…</p>
          ) : userXp.isError ? (
            <p className="mt-2 text-sm text-rose-400">Failed to load XP</p>
          ) : (
            <div className="mt-2 space-y-1 text-sm text-slate-100">
              <p className="text-2xl font-semibold text-slate-100">{userXp.formatted.game ?? "0"}</p>
              <p className="text-xs text-slate-400">Total XP: {userXp.formatted.total ?? "0"}</p>
              {xpAddressLabel && (
                <p className="text-xs text-slate-500">
                  Wallet {xpAddressLabel}
                  {userXp.isFetching ? " • Refreshing…" : ""}
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
