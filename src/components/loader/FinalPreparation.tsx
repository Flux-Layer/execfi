"use client";

import { useEffect, useRef, ReactNode } from 'react';
import { useLoading } from '@/context/LoadingContext';

// Final preparation step - gives React time to hydrate and prepare DOM
// Also handles skipping optional non-critical steps
export function FinalPreparation({ children }: { children: ReactNode }) {
  const { updateStepStatus, completeStep, skipStep } = useLoading();
  const isReady = useRef(false);

  useEffect(() => {
    if (isReady.current) return;

    // Skip non-critical optional steps that aren't provider-tracked
    skipStep('smart-wallet'); // Optional - users may not have smart wallets
    skipStep('base-account'); // Optional - users may not have Base Account

    updateStepStatus('final-prep', 'loading', 0);

    // Give React time to hydrate and prepare DOM
    requestAnimationFrame(() => {
      updateStepStatus('final-prep', 'loading', 50);

      requestAnimationFrame(() => {
        updateStepStatus('final-prep', 'loading', 100);
        completeStep('final-prep');
        isReady.current = true;
      });
    });
  }, [updateStepStatus, completeStep, skipStep]);

  return <>{children}</>;
}
