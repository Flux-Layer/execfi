/**
 * POST /api/onboarding/device/link-wallet
 * Link a device to a wallet address
 */

import { NextRequest, NextResponse } from 'next/server';
import { linkDeviceToWallet } from '@/lib/onboarding/service';

export const runtime = 'nodejs';

interface LinkWalletRequest {
  deviceId: string;
  userAddress: string;
}

interface LinkWalletResponse {
  success: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: LinkWalletRequest = await request.json();

    // Validate required fields
    if (!body.deviceId || typeof body.deviceId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: deviceId is required' },
        { status: 400 }
      );
    }

    if (!body.userAddress || typeof body.userAddress !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: userAddress is required' },
        { status: 400 }
      );
    }

    // Validate Ethereum address format (basic check)
    if (!/^0x[a-fA-F0-9]{40}$/.test(body.userAddress)) {
      return NextResponse.json(
        { error: 'Invalid userAddress format: must be a valid Ethereum address' },
        { status: 400 }
      );
    }

    // Link device to wallet
    await linkDeviceToWallet(body.deviceId, body.userAddress);

    const response: LinkWalletResponse = {
      success: true,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error in POST /api/onboarding/device/link-wallet:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
