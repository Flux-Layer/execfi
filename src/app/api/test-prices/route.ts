import { NextResponse } from 'next/server';
import {
  getTokenPriceUSD,
  getNativeTokenPrice,
  getMultipleTokenPrices,
  getPriceCacheStats,
} from '@/services/priceService';

export async function GET() {
  try {
    const results: any = {
      singlePrices: {},
      nativePrices: {},
      batchPrices: {},
      cacheStats: {},
      errors: [],
    };

    // Test single token price fetch (ETH on Ethereum mainnet)
    try {
      results.singlePrices.ETH = await getTokenPriceUSD('ETH', 1);
    } catch (error) {
      results.errors.push({
        test: 'getTokenPriceUSD(ETH)',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test USDC price
    try {
      results.singlePrices.USDC = await getTokenPriceUSD('USDC', 1);
    } catch (error) {
      results.errors.push({
        test: 'getTokenPriceUSD(USDC)',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test native token price for Ethereum
    try {
      results.nativePrices.Ethereum = await getNativeTokenPrice(1);
    } catch (error) {
      results.errors.push({
        test: 'getNativeTokenPrice(1)',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test native token price for Base
    try {
      results.nativePrices.Base = await getNativeTokenPrice(8453);
    } catch (error) {
      results.errors.push({
        test: 'getNativeTokenPrice(8453)',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test batch price fetching
    try {
      const prices = await getMultipleTokenPrices([
        { symbol: 'ETH', chainId: 1 },
        { symbol: 'USDC', chainId: 1 },
        { symbol: 'USDT', chainId: 1 },
      ]);

      results.batchPrices = {
        'ETH-1': prices.get('ETH-1'),
        'USDC-1': prices.get('USDC-1'),
        'USDT-1': prices.get('USDT-1'),
      };
    } catch (error) {
      results.errors.push({
        test: 'getMultipleTokenPrices',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Get cache statistics
    results.cacheStats = getPriceCacheStats();

    return NextResponse.json({
      success: true,
      message: 'Price service test completed',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
