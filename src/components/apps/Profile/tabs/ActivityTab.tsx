"use client";

import Link from "next/link";
import { getTxUrl } from "@/lib/explorer";
import { useProfileContext } from "../ProfileContext";

export function ActivityTab() {
  const { activity } = useProfileContext();

  if (activity.length === 0) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/50 p-8 text-center">
          <p className="text-sm text-slate-400">No recorded activity yet. Execute a transaction in the terminal to see it here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {activity.map((entry) => {
        const explorerUrl = entry.explorerUrl || (entry.chainId && entry.txHash ? getTxUrl(entry.chainId, entry.txHash) : undefined);
        return (
        <div
          key={entry.id}
          className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-sm shadow-black/40"
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-100 capitalize">{entry.status}</p>
              <p className="text-xs text-slate-400">{entry.description}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{new Date(entry.timestamp).toLocaleString()}</span>
              {entry.chainId && <span>Chain {entry.chainId}</span>}
              {explorerUrl && (
                <Link
                  href={explorerUrl}
                  target="_blank"
                  className="rounded-full border border-white/20 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                >
                  View tx
                </Link>
              )}
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}
