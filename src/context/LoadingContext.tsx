"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';

// Loading step definition
export interface LoadingStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'loading' | 'success' | 'error' | 'skipped';
  progress: number; // 0-100
  weight: number; // Contribution to overall progress (higher = more important)
  startTime?: number;
  endTime?: number;
  error?: Error;
  canFail?: boolean; // If true, errors won't block app load
}

// All loading steps in order
const LOADING_STEPS: Omit<LoadingStep, 'status' | 'progress'>[] = [
  {
    id: 'privy-init',
    label: 'Authentication',
    description: 'Initializing Privy authentication',
    weight: 30,
    canFail: false, // CRITICAL
  },
  {
    id: 'privy-ready',
    label: 'Auth Ready',
    description: 'Authentication system ready',
    weight: 10,
    canFail: false, // CRITICAL
  },
  {
    id: 'smart-wallet',
    label: 'Smart Wallet',
    description: 'Initializing smart wallet support',
    weight: 8,
    canFail: true, // Non-critical, can fallback to EOA
  },
  {
    id: 'wagmi-config',
    label: 'Blockchain',
    description: 'Configuring blockchain connections',
    weight: 15,
    canFail: false, // CRITICAL
  },
  {
    id: 'base-account',
    label: 'Base Account',
    description: 'Checking Base Account connection',
    weight: 5,
    canFail: true, // Non-critical
  },
  {
    id: 'eoa-wallet',
    label: 'Wallet Selection',
    description: 'Loading wallet preferences',
    weight: 5,
    canFail: false, // CRITICAL (need at least EOA)
  },
  {
    id: 'chain-selection',
    label: 'Network',
    description: 'Restoring network selection',
    weight: 5,
    canFail: true, // Can use default chain
  },
  {
    id: 'terminal-store',
    label: 'Terminal',
    description: 'Initializing terminal state',
    weight: 12,
    canFail: false, // CRITICAL
  },
  {
    id: 'onboarding-api',
    label: 'User Profile',
    description: 'Loading user progress',
    weight: 5,
    canFail: true, // Non-critical
  },
  {
    id: 'final-prep',
    label: 'Finalizing',
    description: 'Preparing interface',
    weight: 5,
    canFail: false,
  },
];

interface LoadingContextValue {
  steps: LoadingStep[];
  currentStepIndex: number;
  overallProgress: number; // 0-100 weighted average
  isLoading: boolean;
  isCriticalError: boolean;
  errorMessage?: string;

  // Actions
  updateStepStatus: (stepId: string, status: LoadingStep['status'], progress?: number, error?: Error) => void;
  updateStepProgress: (stepId: string, progress: number) => void;
  completeStep: (stepId: string) => void;
  failStep: (stepId: string, error: Error) => void;
  skipStep: (stepId: string) => void;

  // Timing
  totalLoadTime: number;
  estimatedTimeRemaining: number;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) throw new Error('useLoading must be used within LoadingProvider');
  return context;
};

export const LoadingProvider = ({ children }: { children: ReactNode }) => {
  const [startTime] = useState(Date.now());
  const [steps, setSteps] = useState<LoadingStep[]>(
    LOADING_STEPS.map(step => ({
      ...step,
      status: 'pending' as const,
      progress: 0,
    }))
  );

  // Calculate overall progress (weighted average)
  const overallProgress = useMemo(() => {
    const totalWeight = steps.reduce((sum, s) => sum + s.weight, 0);
    const weightedProgress = steps.reduce((sum, s) => {
      const stepProgress = s.status === 'success' ? 100
                         : s.status === 'skipped' ? 100
                         : s.status === 'error' && s.canFail ? 100
                         : s.progress;
      return sum + (stepProgress * s.weight);
    }, 0);
    return Math.round(weightedProgress / totalWeight);
  }, [steps]);

  // Current step (first non-complete step)
  const currentStepIndex = useMemo(() => {
    return steps.findIndex(s =>
      s.status !== 'success' && s.status !== 'skipped' && !(s.status === 'error' && s.canFail)
    );
  }, [steps]);

  // Check if still loading
  const isLoading = currentStepIndex !== -1;

  // Check for critical errors (non-recoverable failures)
  const isCriticalError = useMemo(() => {
    return steps.some(s => s.status === 'error' && !s.canFail);
  }, [steps]);

  const errorMessage = useMemo(() => {
    const criticalError = steps.find(s => s.status === 'error' && !s.canFail);
    return criticalError?.error?.message || criticalError?.label;
  }, [steps]);

  // Total load time
  const totalLoadTime = Date.now() - startTime;

  // Estimated time remaining (simple heuristic)
  const estimatedTimeRemaining = useMemo(() => {
    if (overallProgress === 0) return 5000; // Default estimate
    if (overallProgress === 100) return 0;

    const timePerPercent = totalLoadTime / overallProgress;
    const remainingPercent = 100 - overallProgress;
    return Math.round(timePerPercent * remainingPercent);
  }, [overallProgress, totalLoadTime]);

  // Update step status
  const updateStepStatus = useCallback((
    stepId: string,
    status: LoadingStep['status'],
    progress = 0,
    error?: Error
  ) => {
    setSteps(prev => prev.map(step => {
      if (step.id !== stepId) return step;

      const updates: Partial<LoadingStep> = { status, progress };

      if (status === 'loading' && !step.startTime) {
        updates.startTime = Date.now();
      }
      if ((status === 'success' || status === 'error' || status === 'skipped') && !step.endTime) {
        updates.endTime = Date.now();
        updates.progress = 100;
      }
      if (error) {
        updates.error = error;
      }

      return { ...step, ...updates };
    }));
  }, []);

  // Helper methods
  const updateStepProgress = useCallback((stepId: string, progress: number) => {
    setSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, progress: Math.min(100, Math.max(0, progress)) } : step
    ));
  }, []);

  const completeStep = useCallback((stepId: string) => {
    updateStepStatus(stepId, 'success', 100);
  }, [updateStepStatus]);

  const failStep = useCallback((stepId: string, error: Error) => {
    updateStepStatus(stepId, 'error', 0, error);
  }, [updateStepStatus]);

  const skipStep = useCallback((stepId: string) => {
    updateStepStatus(stepId, 'skipped', 100);
  }, [updateStepStatus]);

  const value: LoadingContextValue = {
    steps,
    currentStepIndex,
    overallProgress,
    isLoading,
    isCriticalError,
    errorMessage,
    updateStepStatus,
    updateStepProgress,
    completeStep,
    failStep,
    skipStep,
    totalLoadTime,
    estimatedTimeRemaining,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};
