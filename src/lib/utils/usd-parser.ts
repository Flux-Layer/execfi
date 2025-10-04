/**
 * USD Parsing Utilities
 * Handles parsing and formatting of USD values
 */

/**
 * Parse USD input from various formats
 * Accepts: "$100", "100 USD", "100.50", "1,234.56"
 * @param input - User input string
 * @returns Parsed number
 * @throws Error if input is invalid
 */
export function parseUSDInput(input: string): number {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input: expected non-empty string');
  }

  // Remove currency symbols, commas, and whitespace
  const cleaned = input
    .trim()
    .replace(/[$,\s]/g, '')
    .replace(/USD$/i, '')
    .replace(/dollars?$/i, '')
    .trim();

  if (!cleaned) {
    throw new Error('Invalid USD amount: empty after cleaning');
  }

  const amount = parseFloat(cleaned);

  if (isNaN(amount)) {
    throw new Error(`Invalid USD amount: "${input}" cannot be parsed as number`);
  }

  if (amount < 0) {
    throw new Error('USD amount cannot be negative');
  }

  if (!Number.isFinite(amount)) {
    throw new Error('USD amount must be finite');
  }

  return amount;
}

/**
 * Format USD value with intelligent precision
 * @param amount - Amount to format
 * @param precision - Precision mode: 'auto', 'low', 'medium', 'high'
 * @returns Formatted USD string
 */
export function formatUSDValue(
  amount: number,
  precision: 'auto' | 'low' | 'medium' | 'high' = 'auto'
): string {
  if (!Number.isFinite(amount)) {
    return '$0.00';
  }

  let decimals: number;

  if (precision === 'auto') {
    // Auto-adjust precision based on value
    if (amount < 0.01) decimals = 6;       // Very small: $0.000123
    else if (amount < 1) decimals = 4;     // Small: $0.1234
    else if (amount < 100) decimals = 2;   // Medium: $12.34
    else decimals = 0;                      // Large: $1,234
  } else {
    decimals = precision === 'high' ? 6 : precision === 'medium' ? 4 : 2;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Math.min(decimals, 2),
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Format large USD values in compact notation
 * Examples: $1.2K, $45K, $1.2M, $2.5B
 * @param amount - Amount to format
 * @returns Compact formatted USD string
 */
export function formatUSDCompact(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '$0';
  }

  if (amount < 1000) {
    return formatUSDValue(amount, 'low');
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

/**
 * Validate if a string is a valid USD amount
 * @param input - Input string to validate
 * @returns True if valid, false otherwise
 */
export function isValidUSDAmount(input: string): boolean {
  try {
    const amount = parseUSDInput(input);
    return amount >= 0 && Number.isFinite(amount);
  } catch {
    return false;
  }
}

/**
 * Format USD range (min-max)
 * @param min - Minimum amount
 * @param max - Maximum amount
 * @returns Formatted range string
 */
export function formatUSDRange(min: number, max: number): string {
  return `${formatUSDValue(min, 'auto')} - ${formatUSDValue(max, 'auto')}`;
}
