/**
 * POST /api/onboarding/device/register
 * Register a new device or get existing device
 */

import { NextRequest, NextResponse } from 'next/server';
import { registerDevice } from '@/lib/onboarding/service';
import type { DeviceMetadata } from '@/lib/device/types';

export const runtime = 'nodejs';

interface RegisterDeviceRequest {
  fingerprint: string;
  userAgent?: string;
  locale?: string;
  timezone?: string;
}

interface RegisterDeviceResponse {
  deviceId: string;
  created: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterDeviceRequest = await request.json();

    // Validate required fields
    if (!body.fingerprint || typeof body.fingerprint !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: fingerprint is required' },
        { status: 400 }
      );
    }

    // Validate fingerprint format (basic check)
    if (body.fingerprint.length < 10 || body.fingerprint.length > 100) {
      return NextResponse.json(
        { error: 'Invalid fingerprint format' },
        { status: 400 }
      );
    }

    // Prepare metadata
    const metadata: DeviceMetadata = {
      userAgent: body.userAgent,
      locale: body.locale,
      timezone: body.timezone,
    };

    // Register device
    const result = await registerDevice(body.fingerprint, metadata);

    const response: RegisterDeviceResponse = {
      deviceId: result.deviceId,
      created: result.created,
    };

    return NextResponse.json(response, { status: result.created ? 201 : 200 });
  } catch (error) {
    console.error('Error in POST /api/onboarding/device/register:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
