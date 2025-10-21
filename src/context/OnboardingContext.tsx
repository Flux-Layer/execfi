'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useDeviceId } from '@/hooks/useDeviceId';
import { getDeviceMetadata } from '@/lib/device/fingerprint';
import type { OnboardingState } from '@/lib/onboarding/types';
import type { OnboardingStep } from '@/lib/onboarding/types';
import { getStepById } from '@/lib/onboarding/config';
import { useLoading } from '@/context/LoadingContext';

interface OnboardingContextType {
  // Device identification
  deviceId: string | null;

  // Onboarding state
  state: OnboardingState | null;
  showOnboarding: boolean;
  loading: boolean;
  currentStep: OnboardingStep | null;

  // Actions
  completeStep: (stepId: string, data?: any) => Promise<void>;
  skipStep: (stepId: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  goToStep: (stepId: string) => Promise<void>;
  refetch: () => Promise<void>;

  // Backward compatibility (old tutorial system)
  showTutorial: boolean;
  completeTutorial: () => Promise<void>;
  skipTutorial: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { authenticated, user } = usePrivy();
  const { deviceId: fingerprint, loading: deviceLoading } = useDeviceId();
  const { updateStepStatus, completeStep: completeLoadingStep, skipStep: skipLoadingStep, updateStepProgress } = useLoading();

  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<OnboardingStep | null>(null);
  const [dbDeviceId, setDbDeviceId] = useState<string | null>(null); // Database device ID (cuid)
  const [onboardingInitialized, setOnboardingInitialized] = useState(false);

  // Show onboarding if not completed and not skipped
  // Device-based: works WITHOUT authentication
  // User-based: requires authentication (backward compatibility)
  const showOnboarding = !!(
    state &&
    !state.completed &&
    !state.skipped &&
    state.currentStep
  );

  // Backward compatibility: showTutorial
  const showTutorial = showOnboarding;

  /**
   * Fetch onboarding state
   * Priority: Device-based (if deviceId available), then user-based (if authenticated)
   */
  const fetchState = useCallback(async () => {
    // Wait for deviceId to be ready
    if (deviceLoading) {
      return;
    }

    if (!onboardingInitialized) {
      updateStepStatus('onboarding-api', 'loading', 0);
      setOnboardingInitialized(true);
    }

    setLoading(true);

    try {
      // Priority 1: Device-based onboarding (NEW)
      if (fingerprint) {
        updateStepProgress('onboarding-api', 30);
        // Register device first and get database deviceId
        let deviceId = dbDeviceId;
        if (!deviceId) {
          try {
            const metadata = getDeviceMetadata();
            const registerRes = await fetch('/api/onboarding/device/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fingerprint,
                ...metadata,
              }),
            });
            const registerData = await registerRes.json();
            deviceId = registerData.deviceId;
            setDbDeviceId(deviceId);
          } catch (error) {
            console.error('[OnboardingContext] Failed to register device:', error);
            return;
          }
        }

        // Get device onboarding state using database deviceId
        updateStepProgress('onboarding-api', 70);
        const res = await fetch('/api/onboarding/device/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId }),
        });

        const data = await res.json();
        setState(data.state);

        updateStepProgress('onboarding-api', 90);

        // Update current step reference
        if (data.state.currentStep) {
          setCurrentStep(getStepById(data.state.currentStep) || null);
        } else {
          setCurrentStep(null);
        }

        completeLoadingStep('onboarding-api');

        // If user is authenticated, link device to wallet (only if we have database deviceId)
        if (deviceId && authenticated && user?.wallet?.address) {
          try {
            await fetch('/api/onboarding/device/link-wallet', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                deviceId,
                userAddress: user.wallet.address,
              }),
            });
          } catch (error) {
            console.error('[OnboardingContext] Failed to link wallet:', error);
          }
        }

        return;
      }

      // Priority 2: User-based onboarding (LEGACY - backward compatibility)
      if (authenticated && user?.wallet?.address) {
        updateStepProgress('onboarding-api', 50);
        const res = await fetch('/api/onboarding/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAddress: user.wallet.address }),
        });

        const data = await res.json();

        updateStepProgress('onboarding-api', 90);

        // Convert old state format to new format
        const convertedState: OnboardingState = {
          onboarded: data.state.onboarded,
          completed: data.state.tutorialCompleted || false,
          skipped: data.state.tutorialSkipped || false,
          currentStep: data.state.currentStep,
          completedSteps: data.state.completedSteps || [],
          progress: data.state.progress || 0,
          totalSteps: 17,
        };

        setState(convertedState);
        setCurrentStep(
          convertedState.currentStep ? getStepById(convertedState.currentStep) || null : null
        );

        completeLoadingStep('onboarding-api');
        return;
      }

      // No device ID or authentication - skip onboarding API
      skipLoadingStep('onboarding-api');

      // No deviceId and not authenticated - wait
      setState(null);
      setCurrentStep(null);
    } catch (error) {
      console.error('[OnboardingContext] Failed to fetch state:', error);
      setState(null);
      setCurrentStep(null);
      skipLoadingStep('onboarding-api');
    } finally {
      setLoading(false);
    }
  }, [fingerprint, dbDeviceId, deviceLoading, authenticated, user?.wallet?.address, onboardingInitialized, updateStepStatus, updateStepProgress, completeLoadingStep, skipLoadingStep]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  /**
   * Complete a specific onboarding step
   */
  const completeStep = async (stepId: string, data?: any) => {
    try {
      // Device-based (NEW) - use database deviceId
      if (dbDeviceId) {
        await fetch('/api/onboarding/device/complete-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: dbDeviceId, stepId, data }),
        });
        await fetchState();
        return;
      }

      // User-based (LEGACY)
      if (user?.wallet?.address) {
        await fetch('/api/onboarding/complete-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAddress: user.wallet.address, stepId }),
        });
        await fetchState();
      }
    } catch (error) {
      console.error('[OnboardingContext] Failed to complete step:', error);
    }
  };

  /**
   * Skip a specific step (if skippable)
   */
  const skipStep = async (stepId: string) => {
    // Just complete it and move to next for now
    // Can be enhanced later if needed
    await completeStep(stepId, { skipped: true });
  };

  /**
   * Mark entire onboarding as completed
   */
  const completeOnboarding = async () => {
    try {
      // Device-based (NEW) - use database deviceId
      if (dbDeviceId) {
        // Complete all remaining steps would be handled by the last step
        // For now, just refetch to update state
        await fetchState();
        return;
      }

      // User-based (LEGACY)
      if (user?.wallet?.address) {
        await fetch('/api/onboarding/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAddress: user.wallet.address }),
        });
        await fetchState();
      }
    } catch (error) {
      console.error('[OnboardingContext] Failed to complete onboarding:', error);
    }
  };

  /**
   * Skip entire onboarding
   */
  const skipOnboarding = async () => {
    try {
      // Device-based (NEW) - use database deviceId
      if (dbDeviceId) {
        await fetch('/api/onboarding/device/skip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: dbDeviceId }),
        });
        await fetchState();
        return;
      }

      // User-based (LEGACY)
      if (user?.wallet?.address) {
        await fetch('/api/onboarding/skip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAddress: user.wallet.address }),
        });
        await fetchState();
      }
    } catch (error) {
      console.error('[OnboardingContext] Failed to skip onboarding:', error);
    }
  };

  /**
   * Navigate to a specific step
   */
  const goToStep = async (stepId: string) => {
    const step = getStepById(stepId);
    if (step) {
      setCurrentStep(step);
    }
  };

  // Backward compatibility aliases
  const completeTutorial = completeOnboarding;
  const skipTutorial = skipOnboarding;

  return (
    <OnboardingContext.Provider
      value={{
        deviceId: fingerprint, // Return fingerprint for external use
        state,
        showOnboarding,
        loading: loading || deviceLoading,
        currentStep,
        completeStep,
        skipStep,
        completeOnboarding,
        skipOnboarding,
        goToStep,
        refetch: fetchState,
        // Backward compatibility
        showTutorial,
        completeTutorial,
        skipTutorial,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
