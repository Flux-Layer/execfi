/**
 * POST /api/onboarding/device/state
 * Get onboarding state for a device
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDeviceOnboardingState } from '@/lib/onboarding/service';
import type { OnboardingState } from '@/lib/onboarding/types';

export const runtime = 'nodejs';

interface DeviceStateRequest {
  deviceId: string;
}

interface DeviceStateResponse {
  state: OnboardingState;
}

export async function POST(request: NextRequest) {
  try {
    const body: DeviceStateRequest = await request.json();

    // Validate required fields
    if (!body.deviceId || typeof body.deviceId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: deviceId is required' },
        { status: 400 }
      );
    }

    // Get onboarding state
    const state = await getDeviceOnboardingState(body.deviceId);

    const response: DeviceStateResponse = {
      state,
    };

    // Cache for 1 minute (state doesn't change frequently)
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('Error in POST /api/onboarding/device/state:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
