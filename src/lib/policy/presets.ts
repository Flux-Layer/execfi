// Policy preset configurations for ExecFi

import type { PolicyConfig, PolicyPreset } from "./types";

export const POLICY_PRESETS: Record<PolicyPreset, PolicyConfig> = {
  safe: {
    maxTxAmountUSD: 500,           // ~0.1 ETH at $5000
    dailyLimitUSD: 5000,           // ~1 ETH at $5000
    minBalanceAfterTxUSD: 0.50,    // Small buffer
    gasHeadroomMultiplier: 1.2,
    confirmationThresholdUSD: 50,  // ~0.01 ETH at $5000
    blockZeroAddress: true,
    blockUnverifiedTokens: true,
    maxTxPerHour: 5,
    maxTxPerDay: 20,
    requireManualConfirm: true,
  },

  moderate: {
    maxTxAmountUSD: 5000,          // ~1 ETH at $5000
    dailyLimitUSD: 25000,          // ~5 ETH at $5000
    minBalanceAfterTxUSD: 0.01,    // Minimal buffer
    gasHeadroomMultiplier: 1.1,
    confirmationThresholdUSD: 500, // ~0.1 ETH at $5000
    blockZeroAddress: true,
    blockUnverifiedTokens: false,
    maxTxPerHour: 10,
    maxTxPerDay: 50,
    requireManualConfirm: false,
  },

  advanced: {
    maxTxAmountUSD: 50000,         // ~10 ETH at $5000
    dailyLimitUSD: 250000,         // ~50 ETH at $5000
    minBalanceAfterTxUSD: 0.001,   // Minimal buffer
    gasHeadroomMultiplier: 1.1,
    confirmationThresholdUSD: 5000,// ~1 ETH at $5000
    blockZeroAddress: true,
    blockUnverifiedTokens: false,
    maxTxPerHour: 20,
    maxTxPerDay: 100,
    requireManualConfirm: false,
  },

  custom: {
    // Starts as copy of moderate
    maxTxAmountUSD: 5000,
    dailyLimitUSD: 25000,
    minBalanceAfterTxUSD: 0.01,
    gasHeadroomMultiplier: 1.1,
    confirmationThresholdUSD: 500,
    blockZeroAddress: true,
    blockUnverifiedTokens: false,
    maxTxPerHour: 10,
    maxTxPerDay: 50,
    requireManualConfirm: false,
  },
};

export const POLICY_DESCRIPTIONS: Record<PolicyPreset, string> = {
  safe: "Conservative limits, ideal for beginners or high-value wallets",
  moderate: "Balanced protection for regular users",
  advanced: "Higher limits for experienced users with lower restrictions",
  custom: "User-defined policy with custom limits",
};
