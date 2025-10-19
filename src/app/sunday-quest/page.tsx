"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useEOA } from "@/providers/EOAProvider";
import { QuestCard } from "@/components/sunday-quest/QuestCard";
import { useClaimQuestXP } from "@/hooks/sunday-quest/useClaimQuestXP";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";

export default function SundayQuestPage() {
  const { user, authenticated } = usePrivy();
  const { selectedWallet } = useEOA();
  const { claimXP, isPending: isClaimPending } = useClaimQuestXP();
  const [loading, setLoading] = useState(true);
  const [rotation, setRotation] = useState<any>(null);
  const [quests, setQuests] = useState<any[]>([]);

  useEffect(() => {
    loadQuests();
  }, [user]);

  async function loadQuests() {
    setLoading(true);
    try {
      const address = user?.wallet?.address;
      const url = address
        ? `/api/sunday-quest/current?address=${address}`
        : "/api/sunday-quest/current";

      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setRotation(data.rotation);

      // Merge user progress with quests
      const questsWithProgress = data.quests.map((quest: any) => ({
        ...quest,
        userProgress: data.userProgress?.find(
          (p: any) => p.questTemplateId === quest.id
        ),
      }));

      setQuests(questsWithProgress);
    } catch (error) {
      console.error("Failed to load quests:", error);
      toast.error("Failed to load quests");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartQuest(questId: number) {
    if (!user?.wallet?.address) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      const res = await fetch("/api/sunday-quest/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questId,
          userAddress: user.wallet.address,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Quest started!");
        loadQuests(); // Reload
      } else {
        toast.error(data.error || "Failed to start quest");
      }
    } catch (error) {
      console.error("Failed to start quest:", error);
      toast.error("Failed to start quest");
    }
  }

  async function handleVerifyQuest(questId: number) {
    if (!user?.wallet?.address) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      const res = await fetch("/api/sunday-quest/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questId,
          userAddress: user.wallet.address,
        }),
      });

      const data = await res.json();

      if (data.verified) {
        toast.success("Quest completed! You can now claim your XP.");
        loadQuests();
      } else if (data.progress !== undefined) {
        toast.success(`Progress: ${data.progress}% - ${data.message}`);
        loadQuests();
      } else {
        toast.error(data.message || "Quest requirements not met yet");
      }
    } catch (error) {
      console.error("Failed to verify quest:", error);
      toast.error("Failed to verify quest");
    }
  }

  async function handleClaimQuest(questId: number) {
    if (!user?.wallet?.address) {
      toast.error("Please connect your wallet");
      return;
    }

    try {
      // Step 1: Get XP signature from backend
      const claimRes = await fetch("/api/sunday-quest/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questId,
          userAddress: user.wallet.address,
        }),
      });

      const claimData = await claimRes.json();

      if (!claimData.success) {
        toast.error(claimData.error || "Failed to claim");
        return;
      }

      // Step 2: Submit transaction to XPRegistry contract
      const toastId = toast.loading("Submitting XP claim to blockchain...");

      if (!selectedWallet) {
        toast.dismiss(toastId);
        toast.error("No wallet selected. Please select a wallet.");
        return;
      }

      const result = await claimXP(
        claimData.payload,
        claimData.signature as `0x${string}`,
        selectedWallet,
        user.wallet.address as `0x${string}`
      );

      toast.dismiss(toastId);
      toast.success(`Claimed ${claimData.xpAwarded} XP!`);

      // Step 3: Mark as claimed in backend
      await fetch("/api/sunday-quest/mark-claimed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questId,
          userAddress: user.wallet.address,
          transactionHash: result.hash,
        }),
      });

      // Reload quests to show updated status
      loadQuests();
    } catch (error) {
      console.error("Failed to claim quest:", error);
      toast.error("Failed to claim quest");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading quests...</div>
      </div>
    );
  }

  const completedCount = quests.filter(
    (q) => q.userProgress?.status === "CLAIMED"
  ).length;
  const totalXP = quests
    .filter((q) => q.userProgress?.xpAwarded)
    .reduce((sum, q) => sum + (q.userProgress.xpAwarded || 0), 0);

  const timeRemaining = rotation
    ? formatDistanceToNow(new Date(rotation.weekEndDate), { addSuffix: true })
    : "---";

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-b from-purple-900/20 to-transparent p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-white">👑 Sunday Quest</h1>
            <div className="text-right">
              <div className="text-xs text-slate-400">Ends {timeRemaining}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Summary */}
      <div className="max-w-2xl mx-auto px-4 -mt-8">
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-400 mb-1">Progress</div>
              <div className="text-2xl font-bold text-white">
                {completedCount} / {quests.length} Quests
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400 mb-1">XP Earned</div>
              <div className="text-2xl font-bold text-purple-400">
                {totalXP.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 h-3 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              initial={{ width: 0 }}
              animate={{
                width: `${quests.length > 0 ? (completedCount / quests.length) * 100 : 0}%`,
              }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Quest Cards */}
      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-4">
        {quests.map((quest) => (
          <QuestCard
            key={quest.id}
            quest={quest}
            onStart={handleStartQuest}
            onVerify={handleVerifyQuest}
            onClaim={handleClaimQuest}
          />
        ))}
      </div>

      {/* Empty State */}
      {quests.length === 0 && (
        <div className="max-w-2xl mx-auto px-4 mt-12 text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            No Quests Available
          </h2>
          <p className="text-slate-400">
            Check back on Sunday for new weekly quests!
          </p>
        </div>
      )}
    </div>
  );
}
