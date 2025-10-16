/**
 * Onboarding service layer
 * Handles all database operations for device-based onboarding
 */

import { prisma } from '@/lib/db/client';
import { ONBOARDING_STEPS, getStepById, getTotalSteps, getFirstStep } from './config';
import type { OnboardingState } from './types';
import type { DeviceMetadata } from '@/lib/device/types';

/**
 * Register a new device or get existing device
 * @param fingerprint - Device fingerprint
 * @param metadata - Optional device metadata
 * @returns Device ID (cuid)
 */
export async function registerDevice(
  fingerprint: string,
  metadata?: DeviceMetadata
): Promise<{ deviceId: string; created: boolean }> {
  try {
    // Check if device already exists
    const existingDevice = await prisma.device.findUnique({
      where: { fingerprint },
    });

    if (existingDevice) {
      // Update lastSeenAt
      await prisma.device.update({
        where: { id: existingDevice.id },
        data: { lastSeenAt: new Date() },
      });

      return {
        deviceId: existingDevice.id,
        created: false,
      };
    }

    // Create new device
    const device = await prisma.device.create({
      data: {
        fingerprint,
        userAgent: metadata?.userAgent,
        locale: metadata?.locale,
        timezone: metadata?.timezone,
        lastSeenAt: new Date(),
      },
    });

    return {
      deviceId: device.id,
      created: true,
    };
  } catch (error) {
    console.error('Error registering device:', error);
    throw new Error('Failed to register device');
  }
}

/**
 * Get onboarding state for a device
 * @param deviceId - Device ID
 * @returns Onboarding state
 */
export async function getDeviceOnboardingState(deviceId: string): Promise<OnboardingState> {
  try {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        onboardingProgress: {
          where: { completed: true },
          select: { stepId: true },
        },
      },
    });

    if (!device) {
      // Return default state for new device
      return {
        onboarded: false,
        completed: false,
        skipped: false,
        currentStep: getFirstStep().id,
        completedSteps: [],
        progress: 0,
        totalSteps: getTotalSteps(),
      };
    }

    const completedSteps = device.onboardingProgress.map((p) => p.stepId);
    const totalSteps = getTotalSteps();
    const progress = Math.round((completedSteps.length / totalSteps) * 100);

    // Determine current step
    let currentStep: string | null = null;
    if (!device.onboardingCompleted && !device.onboardingSkipped) {
      // Find first incomplete step
      const firstIncomplete = ONBOARDING_STEPS.find(
        (step) => !completedSteps.includes(step.id)
      );
      currentStep = firstIncomplete ? firstIncomplete.id : null;
    }

    return {
      onboarded: device.onboardedAt !== null,
      completed: device.onboardingCompleted,
      skipped: device.onboardingSkipped,
      currentStep,
      completedSteps,
      progress,
      totalSteps,
    };
  } catch (error) {
    console.error('Error getting device onboarding state:', error);
    throw new Error('Failed to get onboarding state');
  }
}

/**
 * Complete a specific onboarding step
 * @param deviceId - Device ID
 * @param stepId - Step ID to complete
 * @param data - Optional step-specific data
 */
export async function completeDeviceStep(
  deviceId: string,
  stepId: string,
  data?: any
): Promise<void> {
  try {
    // Validate step exists
    const step = getStepById(stepId);
    if (!step) {
      throw new Error(`Invalid step ID: ${stepId}`);
    }

    // Upsert progress record (idempotent)
    await prisma.onboardingProgress.upsert({
      where: {
        deviceId_stepId: {
          deviceId,
          stepId,
        },
      },
      update: {
        completed: true,
        completedAt: new Date(),
        data: data ? JSON.parse(JSON.stringify(data)) : null,
      },
      create: {
        deviceId,
        stepId,
        completed: true,
        completedAt: new Date(),
        data: data ? JSON.parse(JSON.stringify(data)) : null,
      },
    });

    // Update device lastSeenAt
    await prisma.device.update({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() },
    });
  } catch (error) {
    console.error('Error completing device step:', error);
    throw new Error('Failed to complete step');
  }
}

/**
 * Mark device onboarding as completed
 * @param deviceId - Device ID
 */
export async function completeDeviceOnboarding(deviceId: string): Promise<void> {
  try {
    await prisma.device.update({
      where: { id: deviceId },
      data: {
        onboardingCompleted: true,
        onboardedAt: new Date(),
        lastSeenAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error completing device onboarding:', error);
    throw new Error('Failed to complete onboarding');
  }
}

/**
 * Mark device onboarding as skipped
 * @param deviceId - Device ID
 */
export async function skipDeviceOnboarding(deviceId: string): Promise<void> {
  try {
    await prisma.device.update({
      where: { id: deviceId },
      data: {
        onboardingSkipped: true,
        onboardedAt: new Date(),
        lastSeenAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error skipping device onboarding:', error);
    throw new Error('Failed to skip onboarding');
  }
}

/**
 * Link device to wallet address
 * @param deviceId - Device ID
 * @param userAddress - Wallet address
 */
export async function linkDeviceToWallet(deviceId: string, userAddress: string): Promise<void> {
  try {
    await prisma.device.update({
      where: { id: deviceId },
      data: {
        userAddress,
        lastSeenAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error linking device to wallet:', error);
    throw new Error('Failed to link device to wallet');
  }
}

/**
 * Reset device onboarding (for testing or user request)
 * @param deviceId - Device ID
 */
export async function resetDeviceOnboarding(deviceId: string): Promise<void> {
  try {
    await prisma.$transaction([
      // Delete all progress records
      prisma.onboardingProgress.deleteMany({
        where: { deviceId },
      }),
      // Reset device flags
      prisma.device.update({
        where: { id: deviceId },
        data: {
          onboardingCompleted: false,
          onboardingSkipped: false,
          onboardedAt: null,
          lastSeenAt: new Date(),
        },
      }),
    ]);
  } catch (error) {
    console.error('Error resetting device onboarding:', error);
    throw new Error('Failed to reset onboarding');
  }
}

// ===================================================================
// User-based functions (backward compatibility with existing system)
// ===================================================================

/**
 * Get onboarding state for authenticated user
 * @param userAddress - Wallet address
 * @returns Onboarding state
 */
export async function getOnboardingState(userAddress: string): Promise<OnboardingState> {
  try {
    const user = await prisma.user.findUnique({
      where: { address: userAddress },
      include: {
        tutorialProgress: {
          where: { completed: true },
          select: { stepId: true },
        },
      },
    });

    if (!user) {
      return {
        onboarded: false,
        completed: false,
        skipped: false,
        currentStep: getFirstStep().id,
        completedSteps: [],
        progress: 0,
        totalSteps: getTotalSteps(),
      };
    }

    const completedSteps = user.tutorialProgress.map((p) => p.stepId);
    const totalSteps = getTotalSteps();
    const progress = Math.round((completedSteps.length / totalSteps) * 100);

    return {
      onboarded: user.onboardedAt !== null,
      completed: user.tutorialCompletedAt !== null,
      skipped: user.tutorialSkipped,
      currentStep: null,
      completedSteps,
      progress,
      totalSteps,
    };
  } catch (error) {
    console.error('Error getting user onboarding state:', error);
    throw new Error('Failed to get onboarding state');
  }
}

/**
 * Complete step for authenticated user
 * @param userAddress - Wallet address
 * @param stepId - Step ID
 */
export async function completeStep(userAddress: string, stepId: string): Promise<void> {
  try {
    await prisma.tutorialProgress.upsert({
      where: {
        userAddress_stepId: {
          userAddress,
          stepId,
        },
      },
      update: {
        completed: true,
        completedAt: new Date(),
      },
      create: {
        userAddress,
        stepId,
        completed: true,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error completing step:', error);
    throw new Error('Failed to complete step');
  }
}

/**
 * Skip tutorial for authenticated user
 * @param userAddress - Wallet address
 */
export async function skipTutorial(userAddress: string): Promise<void> {
  try {
    await prisma.user.upsert({
      where: { address: userAddress },
      update: {
        tutorialSkipped: true,
        onboardedAt: new Date(),
      },
      create: {
        address: userAddress,
        tutorialSkipped: true,
        onboardedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error skipping tutorial:', error);
    throw new Error('Failed to skip tutorial');
  }
}

/**
 * Complete tutorial for authenticated user
 * @param userAddress - Wallet address
 */
export async function completeTutorial(userAddress: string): Promise<void> {
  try {
    await prisma.user.upsert({
      where: { address: userAddress },
      update: {
        tutorialCompletedAt: new Date(),
        onboardedAt: new Date(),
      },
      create: {
        address: userAddress,
        tutorialCompletedAt: new Date(),
        onboardedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error completing tutorial:', error);
    throw new Error('Failed to complete tutorial');
  }
}
