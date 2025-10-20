"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { QuestTemplate, UserQuestProgress } from "@prisma/client";
import clsx from "clsx";

interface QuestCardProps {
  quest: QuestTemplate & {
    userProgress?: UserQuestProgress;
  };
  onStart: (questId: number) => Promise<void>;
  onVerify: (questId: number) => Promise<void>;
  onClaim: (questId: number) => Promise<void>;
}

const DIFFICULTY_COLORS = {
  EASY: "bg-green-500/20 text-green-400 border-green-500/30",
  MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  HARD: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  EPIC: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const QUEST_ICONS: Record<string, string> = {
  eth_transfer_3x: "💸",
  play_degenshoot: "🎮",
  any_transaction_5x: "⚡",
  swap_any_token: "🔄",
  vault_deposit: "🏦",
  gas_optimizer: "⛽",
  bridge_to_base: "🌉",
  transaction_spree: "⚡",
  multi_game_player: "🏆",
  sunday_sweep: "👑",
};

export function QuestCard({ quest, onStart, onVerify, onClaim }: QuestCardProps) {
  const [loading, setLoading] = useState(false);
  const status = quest.userProgress?.status || "AVAILABLE";
  const progress = (quest.userProgress?.progress as any) || {};

  const handleStart = async () => {
    setLoading(true);
    try {
      await onStart(quest.id);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    try {
      await onVerify(quest.id);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    setLoading(true);
    try {
      await onClaim(quest.id);
    } finally {
      setLoading(false);
    }
  };

  const displayXP = Math.floor(quest.baseXpReward * 1.2); // Account for Sunday bonus

  return (
    <motion.div
      className={clsx(
        "rounded-xl border-2 p-6 transition-all",
        status === "CLAIMED" && "border-green-500 bg-green-500/10",
        status === "COMPLETED" && "border-green-500 bg-green-500/10",
        status === "IN_PROGRESS" && "border-yellow-500 bg-yellow-500/10",
        status === "AVAILABLE" &&
          "border-slate-700 bg-slate-800/50 hover:border-purple-500"
      )}
      whileHover={status === "AVAILABLE" ? { scale: 1.02 } : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl">
            {QUEST_ICONS[quest.questKey] || "🎯"}
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">{quest.name}</h3>
            <span
              className={clsx(
                "inline-block text-xs px-2 py-1 rounded-full border mt-1",
                DIFFICULTY_COLORS[quest.difficulty]
              )}
            >
              {quest.difficulty}
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-purple-400 font-bold text-xl">
            +{displayXP} XP
          </div>
          <div className="text-xs text-slate-400">~{quest.estimatedTime}m</div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-300 mb-4">{quest.description}</p>

      {/* Progress Bar */}
      {(status === "IN_PROGRESS" || status === "COMPLETED") && progress.percentage !== undefined && (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Progress</span>
            <span className={clsx(
              "font-semibold",
              status === "COMPLETED" ? "text-green-400" : "text-slate-300"
            )}>
              {progress.percentage}%
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className={clsx(
                "h-full",
                status === "COMPLETED" 
                  ? "bg-gradient-to-r from-green-500 to-emerald-500"
                  : "bg-gradient-to-r from-yellow-500 to-orange-500"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${progress.percentage}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          {progress.transactionCount !== undefined && progress.required !== undefined && (
            <div className="text-xs text-slate-400 mt-1">
              {progress.transactionCount}/{progress.required} transactions completed
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {status === "AVAILABLE" && (
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Starting..." : "Start Quest"}
          </button>
        )}

        {status === "IN_PROGRESS" && (
          <button
            onClick={handleVerify}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Checking..." : "Check Progress"}
          </button>
        )}

        {status === "COMPLETED" && (
          <button
            onClick={handleClaim}
            disabled={loading}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Claiming..." : `Claim ${displayXP} XP`}
          </button>
        )}

        {status === "CLAIMED" && (
          <div className="w-full py-3 text-center text-green-400 font-semibold border border-green-500 rounded-lg">
            ✓ Claimed
          </div>
        )}
      </div>
    </motion.div>
  );
}
