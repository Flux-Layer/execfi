// Slippage utility functions for DeFi operations

/**
 * Convert percentage to decimal
 * @param percent - Slippage percentage (e.g., 0.5 for 0.5%)
 * @returns Decimal representation (e.g., 0.005)
 */
export function slippageToDecimal(percent: number): number {
  return percent / 100;
}

/**
 * Convert decimal to percentage
 * @param decimal - Slippage decimal (e.g., 0.005)
 * @returns Percentage representation (e.g., 0.5)
 */
export function decimalToSlippage(decimal: number): number {
  return decimal * 100;
}

/**
 * Validate slippage range (0.01% - 99%)
 * @param value - Slippage value (can be decimal or percentage)
 * @param isPercent - Whether value is in percentage format
 * @returns true if valid
 */
export function isValidSlippage(value: number, isPercent: boolean = false): boolean {
  const decimal = isPercent ? slippageToDecimal(value) : value;
  return !isNaN(decimal) && decimal >= 0.0001 && decimal <= 0.99;
}

/**
 * Calculate minimum output amount considering slippage
 * @param amount - Expected output amount in smallest unit
 * @param slippage - Slippage tolerance as decimal (e.g., 0.005 for 0.5%)
 * @returns Minimum acceptable output amount
 */
export function calculateMinOutput(amount: bigint, slippage: number): bigint {
  const slippageBasisPoints = BigInt(Math.floor(slippage * 10000));
  const minAmount = (amount * (10000n - slippageBasisPoints)) / 10000n;
  return minAmount;
}

/**
 * Format slippage for display
 * @param decimal - Slippage as decimal (e.g., 0.005)
 * @param precision - Decimal places (default 2)
 * @returns Formatted string (e.g., "0.50%")
 */
export function formatSlippage(decimal: number, precision: number = 2): string {
  const percent = decimalToSlippage(decimal);
  return `${percent.toFixed(precision)}%`;
}

/**
 * Get slippage warning level
 * @param decimal - Slippage as decimal
 * @returns Warning level: 'none' | 'low' | 'high'
 */
export function getSlippageWarning(decimal: number): 'none' | 'low' | 'high' {
  if (decimal < 0.001) {
    return 'low'; // < 0.1%
  }
  if (decimal > 0.02) {
    return 'high'; // > 2%
  }
  return 'none';
}

/**
 * Get slippage warning message
 * @param decimal - Slippage as decimal
 * @returns Warning message or null
 */
export function getSlippageWarningMessage(decimal: number): string | null {
  const warning = getSlippageWarning(decimal);
  
  if (warning === 'low') {
    return '⚠️  Low slippage may cause transaction failures in volatile markets';
  }
  if (warning === 'high') {
    return '⚠️  High slippage may result in unfavorable execution';
  }
  return null;
}

/**
 * Sanitize and normalize slippage input
 * @param value - Raw slippage input
 * @param isPercent - Whether input is in percentage format
 * @param fallback - Fallback value if invalid (default 0.0005)
 * @returns Valid slippage decimal
 */
export function normalizeSlippage(
  value: number | string | undefined,
  isPercent: boolean = false,
  fallback: number = 0.0005
): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue) || numValue < 0) {
    return fallback;
  }

  const decimal = isPercent ? slippageToDecimal(numValue) : numValue;
  
  // Clamp to valid range
  if (decimal < 0.0001) return 0.0001; // Min 0.01%
  if (decimal > 0.99) return 0.99; // Max 99%
  
  return decimal;
}

/**
 * Common slippage presets
 */
export const SLIPPAGE_PRESETS = {
  VERY_LOW: 0.0005,   // 0.05%
  LOW: 0.001,         // 0.1%
  MEDIUM: 0.005,      // 0.5%
  HIGH: 0.01,         // 1%
} as const;

/**
 * Default slippage value
 */
export const DEFAULT_SLIPPAGE = 0.005; // 0.5%
