"use client";

import Link from "next/link";
import { getTxUrl } from "@/lib/explorer";
import { useProfileContext } from "../ProfileContext";
import type { OnChainActivity, TransactionType } from "@/lib/activity/types";
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Repeat, CheckCircle, XCircle, Clock } from "lucide-react";

function getTransactionIcon(type: TransactionType) {
  switch (type) {
    case 'send':
      return <ArrowUpRight className="w-4 h-4 text-orange-400" />;
    case 'receive':
      return <ArrowDownLeft className="w-4 h-4 text-emerald-400" />;
    case 'swap':
      return <Repeat className="w-4 h-4 text-blue-400" />;
    case 'bridge':
      return <RefreshCw className="w-4 h-4 text-purple-400" />;
    default:
      return <ArrowUpRight className="w-4 h-4 text-slate-400" />;
  }
}

function getStatusIcon(status: OnChainActivity['status']) {
  switch (status) {
    case 'confirmed':
      return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-400" />;
    case 'pending':
    case 'app-initiated':
      return <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />;
  }
}

function ActivityItem({ activity }: { activity: OnChainActivity }) {
  const explorerUrl = activity.explorerUrl || getTxUrl(activity.chainId, activity.txHash);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-sm shadow-black/40 hover:bg-slate-900/90 transition-colors">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="mt-1">
          {getTransactionIcon(activity.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-slate-100 capitalize truncate">
              {activity.type.replace('-', ' ')}
            </p>
            {getStatusIcon(activity.status)}
          </div>

          {/* Description */}
          <p className="text-xs text-slate-400 mb-2">{activity.description}</p>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>{new Date(activity.timestamp).toLocaleString()}</span>

            {activity.value.amount !== '0' && parseFloat(activity.value.amount) > 0.0001 && (
              <span className="text-slate-300 font-medium">
                {parseFloat(activity.value.amount).toFixed(4)} {activity.value.symbol}
              </span>
            )}

            {activity.gas.cost !== '0' && parseFloat(activity.gas.cost) > 0 && (
              <span>Gas: {parseFloat(activity.gas.cost).toFixed(6)} ETH</span>
            )}

            {activity.method && (
              <span className="font-mono">{activity.method}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <Link
          href={explorerUrl}
          target="_blank"
          className="shrink-0 rounded-full border border-white/20 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10 transition-colors"
        >
          View
        </Link>
      </div>
    </div>
  );
}

export function ActivityTab() {
  const { activity, activityLoading, activityError, refreshActivity } = useProfileContext();

  if (activityError) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-red-500/30 bg-red-900/20 p-6 text-center">
          <p className="text-sm text-red-300 mb-3">Failed to load activity</p>
          <p className="text-xs text-red-400 mb-4">{activityError.message}</p>
          <button
            onClick={refreshActivity}
            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (activityLoading && activity.length === 0) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/50 p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mb-3"></div>
          <p className="text-sm text-slate-400">Loading activity...</p>
        </div>
      </div>
    );
  }

  if (activity.length === 0) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/50 p-8 text-center">
          <p className="text-sm text-slate-400">
            No activity found. Execute a transaction to see it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-300">
          Recent Activity ({activity.length})
        </h3>
        <button
          onClick={refreshActivity}
          disabled={activityLoading}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          title="Refresh activity"
        >
          <RefreshCw className={`w-4 h-4 text-slate-400 ${activityLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Activity list */}
      <div className="space-y-3">
        {activity.map((entry) => (
          <ActivityItem key={entry.id} activity={entry} />
        ))}
      </div>
    </div>
  );
}
