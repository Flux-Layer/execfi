/**
 * POST /api/onboarding/device/complete-step
 * Mark a specific onboarding step as completed for a device
 */

import { NextRequest, NextResponse } from 'next/server';
import { completeDeviceStep, completeDeviceOnboarding } from '@/lib/onboarding/service';
import { getStepById, isLastStep } from '@/lib/onboarding/config';

export const runtime = 'nodejs';

interface CompleteStepRequest {
  deviceId: string;
  stepId: string;
  data?: any;
}

interface CompleteStepResponse {
  success: boolean;
  completedOnboarding?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: CompleteStepRequest = await request.json();

    // Validate required fields
    if (!body.deviceId || typeof body.deviceId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: deviceId is required' },
        { status: 400 }
      );
    }

    if (!body.stepId || typeof body.stepId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: stepId is required' },
        { status: 400 }
      );
    }

    // Validate step exists
    const step = getStepById(body.stepId);
    if (!step) {
      return NextResponse.json(
        { error: 'Invalid stepId: step not found' },
        { status: 404 }
      );
    }

    // Complete the step (idempotent)
    await completeDeviceStep(body.deviceId, body.stepId, body.data);

    // Check if this was the last step
    const completedOnboarding = isLastStep(body.stepId);

    // If last step, mark onboarding as complete
    if (completedOnboarding) {
      await completeDeviceOnboarding(body.deviceId);
    }

    const response: CompleteStepResponse = {
      success: true,
      completedOnboarding,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error in POST /api/onboarding/device/complete-step:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
