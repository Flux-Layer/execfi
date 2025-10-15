'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import type { OnboardingState } from '@/lib/tutorial/service';

interface OnboardingContextType {
  state: OnboardingState | null;
  showTutorial: boolean;
  loading: boolean;
  completeStep: (stepId: string) => Promise<void>;
  completeTutorial: () => Promise<void>;
  skipTutorial: () => Promise<void>;
  refetch: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { authenticated, user } = usePrivy();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(false);

  const showTutorial = !!(authenticated && state && !state.tutorialCompleted && !state.tutorialSkipped);

  const fetchState = useCallback(async () => {
    if (!authenticated || !user?.wallet?.address) return;
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: user.wallet.address }),
      });
      const data = await res.json();
      setState(data.state);
    } catch (error) {
      console.error('[OnboardingContext] Failed to fetch state:', error);
    } finally {
      setLoading(false);
    }
  }, [authenticated, user?.wallet?.address]);

  useEffect(() => { 
    fetchState(); 
  }, [fetchState]);

  const completeStep = async (stepId: string) => {
    if (!user?.wallet?.address) return;
    try {
      await fetch('/api/onboarding/complete-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: user.wallet.address, stepId }),
      });
      await fetchState();
    } catch (error) {
      console.error('[OnboardingContext] Failed to complete step:', error);
    }
  };

  const completeTutorial = async () => {
    if (!user?.wallet?.address) return;
    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: user.wallet.address }),
      });
      await fetchState();
    } catch (error) {
      console.error('[OnboardingContext] Failed to complete tutorial:', error);
    }
  };

  const skipTutorial = async () => {
    if (!user?.wallet?.address) return;
    try {
      await fetch('/api/onboarding/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: user.wallet.address }),
      });
      await fetchState();
    } catch (error) {
      console.error('[OnboardingContext] Failed to skip tutorial:', error);
    }
  };

  return (
    <OnboardingContext.Provider value={{ 
      state, 
      showTutorial, 
      loading,
      completeStep, 
      completeTutorial, 
      skipTutorial,
      refetch: fetchState,
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used within OnboardingProvider');
  return context;
}
