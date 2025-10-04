import { NextRequest, NextResponse } from 'next/server';
import {
  parseUSDInput,
  formatUSDValue,
  formatUSDCompact,
  isValidUSDAmount,
  formatUSDRange,
} from '@/lib/utils/usd-parser';
import {
  convertUSDToToken,
  convertTokenToUSD,
  formatTokenAsUSD,
} from '@/lib/utils/usd-converter';

export async function GET(request: NextRequest) {
  try {
    // Test USD parser functions
    const parserTests = {
      parseUSDInput: {
        test1: parseUSDInput('$100'),
        test2: parseUSDInput('1,234.56'),
        test3: parseUSDInput('100 USD'),
        test4: parseUSDInput('  $50.25  '),
      },
      formatUSDValue: {
        test1: formatUSDValue(0.000123, 'auto'),
        test2: formatUSDValue(0.5, 'auto'),
        test3: formatUSDValue(12.34, 'auto'),
        test4: formatUSDValue(1234.56, 'auto'),
        test5: formatUSDValue(1234567.89, 'auto'),
      },
      formatUSDCompact: {
        test1: formatUSDCompact(999),
        test2: formatUSDCompact(1200),
        test3: formatUSDCompact(45000),
        test4: formatUSDCompact(1200000),
        test5: formatUSDCompact(1200000000),
      },
      isValidUSDAmount: {
        valid1: isValidUSDAmount('$100'),
        valid2: isValidUSDAmount('1,234.56'),
        invalid1: isValidUSDAmount('invalid'),
        invalid2: isValidUSDAmount('-100'),
        invalid3: isValidUSDAmount(''),
      },
      formatUSDRange: {
        test1: formatUSDRange(10, 100),
        test2: formatUSDRange(0.001, 1000),
      },
    };

    // Test USD converter functions (with mock prices for demonstration)
    const converterTests = {
      note: 'Converter tests may fail if LiFi API is not accessible',
      // We'll test with static fallback prices
    };

    return NextResponse.json({
      success: true,
      message: 'USD utilities test completed',
      results: {
        parser: parserTests,
        converter: converterTests,
      },
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
