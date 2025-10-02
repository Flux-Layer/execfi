// Policy enforcement engine for ExecFi

import { formatEther, formatUnits } from "viem";
import type { PolicyState, PolicyCheckResult, PolicyViolation } from "./types";
import type { NormalizedIntent } from "@/lib/normalize";

/**
 * Check if intent violates policy rules
 */
export function checkPolicy(
  intent: NormalizedIntent,
  policy: PolicyState,
  fromAddress: string
): PolicyCheckResult {
  const violations: PolicyViolation[] = [];

  // Reset quotas if needed
  const updatedPolicy = resetQuotasIfNeeded(policy);

  // Extract ETH-equivalent amount from intent
  const txAmountETH = getIntentAmountETH(intent);

  // Check 1: Per-transaction limit
  if (txAmountETH > updatedPolicy.config.maxTxAmountETH) {
    violations.push({
      code: "MAX_TX_EXCEEDED",
      message: `Transaction amount ${txAmountETH.toFixed(4)} ETH exceeds limit of ${updatedPolicy.config.maxTxAmountETH} ETH`,
      severity: "block",
      suggestion: `Increase limit with: /policy set-max-tx ${Math.ceil(txAmountETH)}`,
    });
  }

  // Check 2: Daily spending limit
  const projectedDailySpent = updatedPolicy.dailySpent + txAmountETH;
  if (projectedDailySpent > updatedPolicy.config.dailyLimitETH) {
    violations.push({
      code: "DAILY_LIMIT_EXCEEDED",
      message: `Daily limit exceeded. Spent: ${updatedPolicy.dailySpent.toFixed(4)} ETH, This tx: ${txAmountETH.toFixed(4)} ETH, Limit: ${updatedPolicy.config.dailyLimitETH} ETH`,
      severity: "block",
      suggestion: `Wait until tomorrow or increase limit with: /policy set-daily-limit ${Math.ceil(projectedDailySpent)}`,
    });
  }

  // Check 3: Hourly transaction count
  if (updatedPolicy.hourlyTxCount >= updatedPolicy.config.maxTxPerHour) {
    violations.push({
      code: "HOURLY_TX_LIMIT",
      message: `Hourly transaction limit reached (${updatedPolicy.config.maxTxPerHour} tx/hour)`,
      severity: "block",
      suggestion: "Wait until next hour or increase limit with: /policy set-hourly-limit",
    });
  }

  // Check 4: Daily transaction count
  if (updatedPolicy.dailyTxCount >= updatedPolicy.config.maxTxPerDay) {
    violations.push({
      code: "DAILY_TX_LIMIT",
      message: `Daily transaction limit reached (${updatedPolicy.config.maxTxPerDay} tx/day)`,
      severity: "block",
      suggestion: "Wait until tomorrow or increase limit with: /policy set-daily-limit",
    });
  }

  // Check 5: Zero address block
  if (updatedPolicy.config.blockZeroAddress && isZeroAddress(intent)) {
    violations.push({
      code: "ZERO_ADDRESS_BLOCKED",
      message: "Sending to zero address is blocked by policy",
      severity: "block",
      suggestion: "Disable with: /policy allow-zero-address",
    });
  }

  // Check 6: Unverified token block
  if (updatedPolicy.config.blockUnverifiedTokens && hasUnverifiedToken(intent)) {
    violations.push({
      code: "UNVERIFIED_TOKEN_BLOCKED",
      message: "Unverified token transfers are blocked by policy",
      severity: "warn",
      suggestion: "Disable with: /policy allow-unverified-tokens",
    });
  }

  // Check 7: Chain allowlist
  if (updatedPolicy.config.allowedChains?.length && !isChainAllowed(intent, updatedPolicy)) {
    violations.push({
      code: "CHAIN_NOT_ALLOWED",
      message: `Chain ${getIntentChainId(intent)} is not in allowed chains list`,
      severity: "block",
      suggestion: "Update allowed chains with: /policy allow-chain <chainId>",
    });
  }

  // Check 8: Address blocklist
  if (isAddressBlocked(intent, updatedPolicy)) {
    violations.push({
      code: "ADDRESS_BLOCKED",
      message: "Recipient address is on the blocklist",
      severity: "block",
      suggestion: "This address is flagged as potentially unsafe",
    });
  }

  // Check 9: Confirmation threshold
  if (txAmountETH > updatedPolicy.config.confirmationThresholdETH || updatedPolicy.config.requireManualConfirm) {
    violations.push({
      code: "CONFIRMATION_REQUIRED",
      message: `Manual confirmation required for amounts over ${updatedPolicy.config.confirmationThresholdETH} ETH`,
      severity: "warn",
    });
  }

  // Determine if transaction is allowed (no blocking violations)
  const blockingViolations = violations.filter(v => v.severity === "block");
  const allowed = blockingViolations.length === 0;

  return { allowed, violations };
}

/**
 * Track transaction in policy state (call after successful execution)
 */
export function trackTransaction(policy: PolicyState, amountETH: number): PolicyState {
  const updated = resetQuotasIfNeeded(policy);

  return {
    ...updated,
    dailySpent: updated.dailySpent + amountETH,
    dailyTxCount: updated.dailyTxCount + 1,
    hourlyTxCount: updated.hourlyTxCount + 1,
  };
}

/**
 * Reset daily/hourly quotas if time window has passed
 */
function resetQuotasIfNeeded(policy: PolicyState): PolicyState {
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const currentHour = now.getHours();

  let updated = { ...policy };

  // Reset daily counters if date changed
  if (currentDate !== policy.lastResetDate) {
    updated = {
      ...updated,
      dailySpent: 0,
      dailyTxCount: 0,
      hourlyTxCount: 0,
      lastResetDate: currentDate,
      lastResetHour: currentHour,
    };
  }
  // Reset hourly counter if hour changed
  else if (currentHour !== policy.lastResetHour) {
    updated = {
      ...updated,
      hourlyTxCount: 0,
      lastResetHour: currentHour,
    };
  }

  return updated;
}

/**
 * Extract ETH-equivalent amount from intent
 */
export function getIntentAmountETH(intent: NormalizedIntent): number {
  if (intent.kind === "native-transfer") {
    return parseFloat(formatEther(intent.amountWei));
  }
  if (intent.kind === "erc20-transfer") {
    // Simplified: assume token value, would need price oracle in production
    return parseFloat(formatUnits(intent.amountWei, intent.token.decimals));
  }
  if (intent.kind === "swap") {
    return parseFloat(formatUnits(intent.fromAmount, intent.fromToken.decimals));
  }
  if (intent.kind === "bridge") {
    return parseFloat(formatUnits(intent.amount, intent.token.decimals));
  }
  if (intent.kind === "bridge-swap") {
    return parseFloat(formatUnits(intent.fromAmount, intent.fromToken.decimals));
  }
  return 0;
}

function isZeroAddress(intent: NormalizedIntent): boolean {
  if (intent.kind === "native-transfer" || intent.kind === "erc20-transfer") {
    return intent.to === "0x0000000000000000000000000000000000000000";
  }
  return false;
}

function hasUnverifiedToken(intent: NormalizedIntent): boolean {
  // Note: Token verification info not currently available in normalized intents
  // This check is disabled until token metadata includes verified status
  // TODO: Add verified field to token types when token verification is implemented
  return false;

  // Future implementation when token.verified is available:
  // if (intent.kind === "erc20-transfer") {
  //   return !intent.token.verified;
  // }
  // if (intent.kind === "swap") {
  //   return !intent.fromToken.verified || !intent.toToken.verified;
  // }
  // if (intent.kind === "bridge") {
  //   return !intent.token.verified;
  // }
  // if (intent.kind === "bridge-swap") {
  //   return !intent.fromToken.verified || !intent.toToken.verified;
  // }
  // return false;
}

function getIntentChainId(intent: NormalizedIntent): number {
  if (intent.kind === "native-transfer" || intent.kind === "erc20-transfer") {
    return intent.chainId;
  }
  if (intent.kind === "swap") {
    return intent.fromChainId;
  }
  if (intent.kind === "bridge" || intent.kind === "bridge-swap") {
    return intent.fromChainId;
  }
  return 0;
}

function isChainAllowed(intent: NormalizedIntent, policy: PolicyState): boolean {
  const chainId = getIntentChainId(intent);
  return policy.config.allowedChains?.includes(chainId) ?? true;
}

function isAddressBlocked(intent: NormalizedIntent, policy: PolicyState): boolean {
  if (intent.kind === "native-transfer" || intent.kind === "erc20-transfer") {
    return policy.config.blockedAddresses?.includes(intent.to.toLowerCase()) ?? false;
  }
  return false;
}
