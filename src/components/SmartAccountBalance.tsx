"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import { formatBalanceWithUSD } from "@/lib/utils/balance";
import { formatUSDValue } from "@/lib/utils";
import { getTokenPriceUSD } from "@/services/priceService";

interface SmartAccountBalanceProps {
  address: string | undefined;
  chainId?: number;
}

interface TokenBalance {
  symbol: string;
  balance: bigint;
  decimals: number;
  formatted: string;
  priceUSD?: number;
}

const SmartAccountBalance = ({ address, chainId = 8453 }: SmartAccountBalanceProps) => {
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [lastFetch, setLastFetch] = useState<number>(0);

  const fetchBalances = async () => {
    if (!address) return;

    // Prevent too frequent requests
    const now = Date.now();
    if (now - lastFetch < 5000) return; // 5 second cooldown

    try {
      setLoading(true);
      setError(undefined);

      const response = await fetch("/api/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chainId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Fetch price for ETH
      let priceUSD: number | undefined;
      try {
        priceUSD = await getTokenPriceUSD('ETH', chainId);
      } catch (error) {
        console.warn("Failed to fetch ETH price:", error);
      }

      const ethBalance: TokenBalance = {
        symbol: "ETH",
        balance: BigInt(data.balance || "0"),
        decimals: 18,
        formatted: formatEther(BigInt(data.balance || "0")),
        priceUSD,
      };

      setBalances([ethBalance]);
      setLastFetch(now);

    } catch (err: any) {
      console.error("Failed to fetch Smart Account balances:", err);
      setError(err.message || "Failed to fetch balances");
      setBalances([{
        symbol: "ETH",
        balance: BigInt(0),
        decimals: 18,
        formatted: "0"
      }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [address]);

  const formatBalanceDisplay = (
    balance: bigint,
    decimals: number,
    symbol: string,
    priceUSD?: number
  ): string => {
    return formatBalanceWithUSD(balance, decimals, symbol, priceUSD);
  };

  if (!address) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Balance
        </label>
        <div className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/10">
          <div className="w-2 h-2 bg-gray-500 rounded-full" />
          <span className="text-gray-400 text-sm">No Smart Account</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Balance
        </label>
        <button
          onClick={fetchBalances}
          disabled={loading || (Date.now() - lastFetch < 5000)}
          className="text-xs text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh balance"
        >
          <svg
            className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <motion.div
            className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="w-2 h-2 bg-blue-500 rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-blue-400 text-sm">Loading...</span>
          </motion.div>
        ) : error ? (
          <motion.div
            className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-red-500/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-red-400 text-sm">Error loading</span>
          </motion.div>
        ) : (
          <AnimatePresence>
            {balances.map((token) => (
              <motion.div
                key={token.symbol}
                className="flex items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/10"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-white text-sm font-mono flex-1">
                  {formatBalanceDisplay(token.balance, token.decimals, token.symbol, token.priceUSD)}
                </span>
                {token.balance > 0 && (
                  <motion.div
                    className="text-xs text-green-400"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    ✓
                  </motion.div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Total Portfolio Value */}
        {!loading && !error && (() => {
          const totalUSD = balances.reduce((sum, token) => {
            if (!token.priceUSD) return sum;
            const amount = Number(token.balance) / Math.pow(10, token.decimals);
            return sum + (amount * token.priceUSD);
          }, 0);

          return totalUSD > 0 ? (
            <motion.div
              className="mt-2 p-3 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-500/30"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="text-xs text-gray-400 uppercase tracking-wide">
                Total Value
              </div>
              <div className="text-lg font-bold text-purple-300">
                {formatUSDValue(totalUSD, 'medium')}
              </div>
            </motion.div>
          ) : null;
        })()}
      </div>
    </div>
  );
};

export default SmartAccountBalance;