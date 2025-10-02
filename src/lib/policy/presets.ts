// Policy preset configurations for ExecFi

import type { PolicyConfig, PolicyPreset } from "./types";

export const POLICY_PRESETS: Record<PolicyPreset, PolicyConfig> = {
  safe: {
    maxTxAmountETH: 0.1,
    dailyLimitETH: 1.0,
    minBalanceAfterTxETH: 0.001,
    gasHeadroomMultiplier: 1.2,
    confirmationThresholdETH: 0.01,
    blockZeroAddress: true,
    blockUnverifiedTokens: true,
    maxTxPerHour: 5,
    maxTxPerDay: 20,
    requireManualConfirm: true,
  },

  moderate: {
    maxTxAmountETH: 1.0,
    dailyLimitETH: 5.0,
    minBalanceAfterTxETH: 0.001,
    gasHeadroomMultiplier: 1.1,
    confirmationThresholdETH: 0.1,
    blockZeroAddress: true,
    blockUnverifiedTokens: false,
    maxTxPerHour: 10,
    maxTxPerDay: 50,
    requireManualConfirm: false,
  },

  advanced: {
    maxTxAmountETH: 10.0,
    dailyLimitETH: 50.0,
    minBalanceAfterTxETH: 0.0001,
    gasHeadroomMultiplier: 1.1,
    confirmationThresholdETH: 1.0,
    blockZeroAddress: true,
    blockUnverifiedTokens: false,
    maxTxPerHour: 20,
    maxTxPerDay: 100,
    requireManualConfirm: false,
  },

  custom: {
    // Starts as copy of moderate
    maxTxAmountETH: 1.0,
    dailyLimitETH: 5.0,
    minBalanceAfterTxETH: 0.001,
    gasHeadroomMultiplier: 1.1,
    confirmationThresholdETH: 0.1,
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
