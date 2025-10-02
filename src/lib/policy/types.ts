// Policy system types for ExecFi transaction protection

export type PolicyConfig = {
  // Transaction Limits
  maxTxAmountETH: number;           // Max per-transaction in ETH equivalent
  dailyLimitETH: number;             // Max daily spending in ETH equivalent

  // Safety Rules
  minBalanceAfterTxETH: number;      // Minimum balance to maintain after tx
  gasHeadroomMultiplier: number;     // Gas estimation buffer (1.1 = 110%)

  // Security Controls
  confirmationThresholdETH: number;  // Require manual confirm above this amount
  blockZeroAddress: boolean;         // Block sends to 0x0 address
  blockUnverifiedTokens: boolean;    // Block transfers of unverified tokens

  // Usage Quotas
  maxTxPerHour: number;              // Rate limiting per hour
  maxTxPerDay: number;               // Rate limiting per day

  // Advanced
  allowedChains?: number[];          // Whitelist specific chains (empty = all)
  blockedAddresses?: string[];       // Blacklist addresses (scam protection)
  requireManualConfirm: boolean;     // Always require confirmation regardless of amount
};

export type PolicyPreset = "safe" | "moderate" | "advanced" | "custom";

export type PolicyMetadata = {
  preset: PolicyPreset;
  lastModified: number;              // Timestamp
  version: string;                   // Policy schema version
};

export type PolicyState = {
  config: PolicyConfig;
  metadata: PolicyMetadata;

  // Runtime tracking for quotas
  dailySpent: number;                // ETH spent today
  dailyTxCount: number;              // Transactions today
  hourlyTxCount: number;             // Transactions this hour
  lastResetDate: string;             // ISO date for daily reset
  lastResetHour: number;             // Hour for hourly reset
};

export type PolicyViolation = {
  code: string;
  message: string;
  severity: "block" | "warn";
  suggestion?: string;
};

export type PolicyCheckResult = {
  allowed: boolean;
  violations: PolicyViolation[];
};
