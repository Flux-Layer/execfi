// lib/utils/balance.ts - Balance formatting utilities

import { formatUnits } from "viem";
import { formatUSDValue } from "./usd-parser";

/**
 * Format balance with appropriate decimal places for display
 * @param value - Raw balance value (bigint)
 * @param decimals - Token decimals
 * @param maxDecimals - Maximum decimal places to show (default: 6)
 * @returns Formatted balance string
 */
export function formatBalance(
  value: bigint,
  decimals: number,
  maxDecimals: number = 6
): string {
  const formatted = formatUnits(value, decimals);
  const num = parseFloat(formatted);

  // For very small amounts, show more precision
  if (num === 0) return "0";
  if (num < 0.000001) return formatted; // Show full precision for tiny amounts

  // For larger amounts, limit decimal places but avoid scientific notation
  return num.toFixed(Math.min(maxDecimals, decimals)).replace(/\.?0+$/, "");
}

/**
 * Format balance for terminal display with consistent precision
 * @param value - Raw balance value (bigint)
 * @param decimals - Token decimals
 * @param symbol - Token symbol
 * @returns Formatted balance with symbol
 */
export function formatBalanceDisplay(
  value: bigint,
  decimals: number,
  symbol: string
): string {
  const formatted = formatBalance(value, decimals);
  return `${formatted} ${symbol}`;
}

/**
 * Parse user input amount to Wei
 * @param amount - User input amount as string
 * @param decimals - Token decimals
 * @returns Amount in Wei (bigint)
 */
export function parseAmountToWei(amount: string, decimals: number): bigint {
  // Remove any non-numeric characters except decimal point
  const cleanAmount = amount.replace(/[^0-9.]/g, "");

  if (!cleanAmount || cleanAmount === ".") {
    throw new Error("Invalid amount");
  }

  // Check for multiple decimal points
  if ((cleanAmount.match(/\./g) || []).length > 1) {
    throw new Error("Invalid amount format");
  }

  try {
    // Use parseUnits equivalent
    const [whole, fraction = ""] = cleanAmount.split(".");
    const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
    const fullAmount = whole + paddedFraction;

    return BigInt(fullAmount);
  } catch (error) {
    throw new Error("Failed to parse amount");
  }
}

/**
 * Check if user has sufficient balance for a transaction
 * @param balance - User's balance (bigint)
 * @param amount - Amount to send (bigint)
 * @param gasEstimate - Estimated gas cost in Wei (bigint, optional)
 * @returns true if sufficient balance
 */
export function hasSufficientBalance(
  balance: bigint,
  amount: bigint,
  gasEstimate: bigint = BigInt(0)
): boolean {
  return balance >= amount + gasEstimate;
}

/**
 * Format balance with USD equivalent
 * @param value - Raw balance value (bigint)
 * @param decimals - Token decimals
 * @param symbol - Token symbol
 * @param priceUSD - Token price in USD (optional)
 * @returns Formatted balance with optional USD value
 */
export function formatBalanceWithUSD(
  value: bigint,
  decimals: number,
  symbol: string,
  priceUSD?: number
): string {
  // Validate decimals (defensive programming)
  if (decimals < 0 || decimals > 77) {
    console.error(`❌ [Balance] Invalid decimals for ${symbol}: ${decimals}`);
    return `${value.toString()} ${symbol} (invalid decimals)`;
  }

  const formatted = formatBalance(value, decimals);

  if (!priceUSD || priceUSD === 0) {
    return `${formatted} ${symbol}`;
  }

  const usdValue = parseFloat(formatted) * priceUSD;
  const usdFormatted = formatUSDValue(usdValue, 'auto');

  return `${formatted} ${symbol} (${usdFormatted})`;
}

/**
 * Calculate USD value for a token amount
 * @param value - Raw balance value (bigint)
 * @param decimals - Token decimals
 * @param priceUSD - Token price in USD
 * @returns USD value as number
 */
export function calculateTokenUSDValue(
  value: bigint,
  decimals: number,
  priceUSD: number
): number {
  // Validate decimals
  if (decimals < 0 || decimals > 77) {
    console.error(`❌ [Balance] Invalid decimals in USD calculation: ${decimals}`);
    throw new Error(`Invalid decimals: ${decimals}. Expected 0-77.`);
  }

  const formatted = formatUnits(value, decimals);
  const usdValue = parseFloat(formatted) * priceUSD;

  // Log unusual values for monitoring
  if (usdValue > 1000000) {
    console.warn(`⚠️ [Balance] High USD value detected: $${usdValue.toFixed(2)} for ${formatted} tokens at $${priceUSD}`);
  }

  return usdValue;
}

/**
 * Check if USD value meets minimum threshold
 * @param value - Raw balance value (bigint)
 * @param decimals - Token decimals
 * @param priceUSD - Token price in USD
 * @param minUSD - Minimum USD threshold
 * @returns true if meets or exceeds threshold
 */
export function meetsMinimumUSDValue(
  value: bigint,
  decimals: number,
  priceUSD: number,
  minUSD: number
): boolean {
  const usdValue = calculateTokenUSDValue(value, decimals, priceUSD);
  return usdValue >= minUSD;
}