import { NextRequest, NextResponse } from 'next/server';
import { skipDeviceOnboarding } from '@/lib/onboarding/service';

/**
 * POST /api/onboarding/device/skip
 * Skip device onboarding (mark as skipped)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID is required' },
        { status: 400 }
      );
    }

    // Mark onboarding as skipped
    await skipDeviceOnboarding(deviceId);

    return NextResponse.json(
      {
        success: true,
        message: 'Onboarding skipped successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Skip device onboarding error:', error);
    return NextResponse.json(
      {
        error: 'Failed to skip onboarding',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
