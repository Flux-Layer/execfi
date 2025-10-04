/**
 * USD Conversion Utilities
 * Converts between USD amounts and token amounts using real-time prices
 */

import { getTokenPriceUSD, getNativeTokenPrice } from '@/services/priceService';
import { parseUSDInput, formatUSDValue } from './usd-parser';

/**
 * Convert USD amount to token amount
 * @param usdAmount - USD amount (can be string like "$100" or number)
 * @param tokenSymbol - Token symbol (ETH, USDC, etc.)
 * @param chainId - Chain ID
 * @param tokenDecimals - Token decimals (default: 18)
 * @returns Token amount as string with full precision
 */
export async function convertUSDToToken(
  usdAmount: string | number,
  tokenSymbol: string,
  chainId: number,
  tokenDecimals: number = 18
): Promise<string> {
  // Parse USD amount
  const usdValue = typeof usdAmount === 'string' 
    ? parseUSDInput(usdAmount) 
    : usdAmount;

  if (usdValue <= 0) {
    throw new Error('USD amount must be greater than zero');
  }

  // Get token price
  const tokenPrice = await getTokenPriceUSD(tokenSymbol, chainId);

  if (tokenPrice <= 0) {
    throw new Error(`Invalid price for ${tokenSymbol}: ${tokenPrice}`);
  }

  // Calculate token amount
  const tokenAmount = usdValue / tokenPrice;

  // Return with appropriate precision
  return tokenAmount.toFixed(tokenDecimals);
}

/**
 * Convert token amount to USD value
 * @param tokenAmount - Token amount (as string or number)
 * @param tokenSymbol - Token symbol
 * @param chainId - Chain ID
 * @returns Formatted USD value
 */
export async function convertTokenToUSD(
  tokenAmount: string | number,
  tokenSymbol: string,
  chainId: number
): Promise<number> {
  const amount = typeof tokenAmount === 'string' 
    ? parseFloat(tokenAmount) 
    : tokenAmount;

  if (isNaN(amount) || amount < 0) {
    throw new Error('Invalid token amount');
  }

  // Get token price
  const tokenPrice = await getTokenPriceUSD(tokenSymbol, chainId);

  // Calculate USD value
  return amount * tokenPrice;
}

/**
 * Format token amount as USD string
 * @param tokenAmount - Token amount
 * @param tokenSymbol - Token symbol
 * @param chainId - Chain ID
 * @param precision - Formatting precision
 * @returns Formatted USD string (e.g., "$123.45")
 */
export async function formatTokenAsUSD(
  tokenAmount: string | number,
  tokenSymbol: string,
  chainId: number,
  precision: 'auto' | 'low' | 'medium' | 'high' = 'auto'
): Promise<string> {
  const usdValue = await convertTokenToUSD(tokenAmount, tokenSymbol, chainId);
  return formatUSDValue(usdValue, precision);
}

/**
 * Get exchange rate for a token pair
 * @param fromToken - Source token symbol
 * @param toToken - Destination token symbol
 * @param chainId - Chain ID (assumes both tokens on same chain)
 * @returns Exchange rate (1 fromToken = X toToken)
 */
export async function getExchangeRate(
  fromToken: string,
  toToken: string,
  chainId: number
): Promise<number> {
  const [fromPrice, toPrice] = await Promise.all([
    getTokenPriceUSD(fromToken, chainId),
    getTokenPriceUSD(toToken, chainId),
  ]);

  if (toPrice === 0) {
    throw new Error(`Invalid price for ${toToken}`);
  }

  return fromPrice / toPrice;
}

/**
 * Convert between two tokens using USD as intermediary
 * @param amount - Source token amount
 * @param fromToken - Source token symbol
 * @param toToken - Destination token symbol
 * @param chainId - Chain ID
 * @param toTokenDecimals - Destination token decimals (default: 18)
 * @returns Destination token amount as string
 */
export async function convertTokenToToken(
  amount: string | number,
  fromToken: string,
  toToken: string,
  chainId: number,
  toTokenDecimals: number = 18
): Promise<string> {
  const sourceAmount = typeof amount === 'string' 
    ? parseFloat(amount) 
    : amount;

  if (isNaN(sourceAmount) || sourceAmount < 0) {
    throw new Error('Invalid source amount');
  }

  // Get exchange rate
  const rate = await getExchangeRate(fromToken, toToken, chainId);

  // Calculate destination amount
  const destAmount = sourceAmount * rate;

  return destAmount.toFixed(toTokenDecimals);
}

/**
 * Calculate slippage for a swap
 * @param inputUSD - Input amount in USD
 * @param outputUSD - Output amount in USD
 * @returns Slippage percentage (positive = loss, negative = gain)
 */
export function calculateSlippage(inputUSD: number, outputUSD: number): number {
  if (inputUSD === 0) return 0;
  return ((inputUSD - outputUSD) / inputUSD) * 100;
}

/**
 * Apply slippage tolerance to a USD amount
 * @param usdAmount - USD amount
 * @param slippagePercent - Slippage tolerance percentage (e.g., 1 for 1%)
 * @returns Minimum acceptable USD amount
 */
export function applySlippageTolerance(
  usdAmount: number,
  slippagePercent: number
): number {
  return usdAmount * (1 - slippagePercent / 100);
}

/**
 * Check if USD amount is within slippage tolerance
 * @param expectedUSD - Expected USD amount
 * @param actualUSD - Actual USD amount
 * @param slippagePercent - Slippage tolerance percentage
 * @returns True if within tolerance
 */
export function isWithinSlippageTolerance(
  expectedUSD: number,
  actualUSD: number,
  slippagePercent: number
): boolean {
  const minAcceptable = applySlippageTolerance(expectedUSD, slippagePercent);
  return actualUSD >= minAcceptable;
}

/**
 * Batch convert multiple token amounts to USD
 * @param conversions - Array of conversion requests
 * @returns Array of USD values in same order
 */
export async function batchConvertToUSD(
  conversions: Array<{
    tokenAmount: string | number;
    tokenSymbol: string;
    chainId: number;
  }>
): Promise<number[]> {
  return await Promise.all(
    conversions.map(({ tokenAmount, tokenSymbol, chainId }) =>
      convertTokenToUSD(tokenAmount, tokenSymbol, chainId)
    )
  );
}

/**
 * Get native token value in USD for a chain
 * @param amount - Native token amount
 * @param chainId - Chain ID
 * @returns USD value
 */
export async function convertNativeTokenToUSD(
  amount: string | number,
  chainId: number
): Promise<number> {
  const tokenAmount = typeof amount === 'string' 
    ? parseFloat(amount) 
    : amount;

  if (isNaN(tokenAmount) || tokenAmount < 0) {
    throw new Error('Invalid native token amount');
  }

  const price = await getNativeTokenPrice(chainId);
  return tokenAmount * price;
}
