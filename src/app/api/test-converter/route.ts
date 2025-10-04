import { NextRequest, NextResponse } from 'next/server';
import {
  convertUSDToToken,
  convertTokenToUSD,
  formatTokenAsUSD,
  getExchangeRate,
  convertTokenToToken,
  calculateSlippage,
  applySlippageTolerance,
  isWithinSlippageTolerance,
} from '@/lib/utils/usd-converter';

export async function GET(request: NextRequest) {
  try {
    const results: any = {
      usdToToken: {},
      tokenToUSD: {},
      formatAsUSD: {},
      exchangeRate: {},
      tokenToToken: {},
      slippage: {},
      errors: [],
    };

    // Test USD to Token conversion
    try {
      results.usdToToken.eth100 = await convertUSDToToken('$100', 'ETH', 1, 18);
      results.usdToToken.usdc100 = await convertUSDToToken(100, 'USDC', 1, 6);
    } catch (error) {
      results.errors.push({
        test: 'convertUSDToToken',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test Token to USD conversion
    try {
      results.tokenToUSD.eth1 = await convertTokenToUSD('1', 'ETH', 1);
      results.tokenToUSD.usdc100 = await convertTokenToUSD('100', 'USDC', 1);
    } catch (error) {
      results.errors.push({
        test: 'convertTokenToUSD',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test format token as USD
    try {
      results.formatAsUSD.eth1 = await formatTokenAsUSD('1', 'ETH', 1);
      results.formatAsUSD.eth05 = await formatTokenAsUSD('0.5', 'ETH', 1);
    } catch (error) {
      results.errors.push({
        test: 'formatTokenAsUSD',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test exchange rate
    try {
      results.exchangeRate.ethToUsdc = await getExchangeRate('ETH', 'USDC', 1);
      results.exchangeRate.usdcToEth = await getExchangeRate('USDC', 'ETH', 1);
    } catch (error) {
      results.errors.push({
        test: 'getExchangeRate',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test token to token conversion
    try {
      results.tokenToToken.eth1ToUsdc = await convertTokenToToken('1', 'ETH', 'USDC', 1, 6);
      results.tokenToToken.usdc1000ToEth = await convertTokenToToken('1000', 'USDC', 'ETH', 1, 18);
    } catch (error) {
      results.errors.push({
        test: 'convertTokenToToken',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test slippage calculations
    results.slippage = {
      loss2percent: calculateSlippage(100, 98),
      gain2percent: calculateSlippage(100, 102),
      noSlippage: calculateSlippage(100, 100),
      tolerance1percent: applySlippageTolerance(100, 1),
      tolerance5percent: applySlippageTolerance(1000, 5),
      withinTolerance: isWithinSlippageTolerance(100, 99.5, 1),
      outsideTolerance: isWithinSlippageTolerance(100, 98, 1),
    };

    return NextResponse.json({
      success: true,
      message: 'USD converter test completed',
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
