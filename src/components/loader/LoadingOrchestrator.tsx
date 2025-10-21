"use client";

import { useEffect, useState, useRef, ReactNode } from 'react';
import { useLoading } from '@/context/LoadingContext';
import { PathFinderLoader } from './path-finder';

const MIN_DISPLAY_TIME = 800; // Minimum time to show loader (prevents flash)
const MAX_LOAD_TIME = 10000; // Maximum time before forcing show app
const FADE_DURATION = 700; // Fade out animation duration

interface LoadingOrchestratorProps {
  children: ReactNode;
}

export const LoadingOrchestrator = ({ children }: LoadingOrchestratorProps) => {
  const { isLoading, isCriticalError, overallProgress, steps, currentStepIndex, errorMessage } = useLoading();

  const [showLoader, setShowLoader] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [forceShow, setForceShow] = useState(false);

  const mountTime = useRef(Date.now());
  const minDisplayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Enforce minimum display time
  useEffect(() => {
    minDisplayTimeoutRef.current = setTimeout(() => {
      setForceShow(true);
    }, MIN_DISPLAY_TIME);

    return () => {
      if (minDisplayTimeoutRef.current) clearTimeout(minDisplayTimeoutRef.current);
    };
  }, []);

  // Maximum load timeout (safety fallback)
  useEffect(() => {
    maxLoadTimeoutRef.current = setTimeout(() => {
      console.warn('Max load time exceeded, forcing app display');
      setShowLoader(false);
    }, MAX_LOAD_TIME);

    return () => {
      if (maxLoadTimeoutRef.current) clearTimeout(maxLoadTimeoutRef.current);
    };
  }, []);

  // Handle loading completion
  useEffect(() => {
    if (!isLoading && forceShow && !isCriticalError) {
      // All loading complete and minimum time elapsed
      const elapsedTime = Date.now() - mountTime.current;

      // If we loaded super fast, wait a bit for perceived quality
      const remainingMinTime = Math.max(0, MIN_DISPLAY_TIME - elapsedTime);

      setTimeout(() => {
        setIsFadingOut(true);

        // After fade animation, hide loader completely
        setTimeout(() => {
          setShowLoader(false);
        }, FADE_DURATION);
      }, remainingMinTime);
    }
  }, [isLoading, forceShow, isCriticalError]);

  // Handle critical errors
  useEffect(() => {
    if (isCriticalError && forceShow) {
      // Show error state after minimum display time
      setIsFadingOut(false); // Cancel any fade out
    }
  }, [isCriticalError, forceShow]);

  // Get current step info for display
  const currentStep = currentStepIndex >= 0 ? steps[currentStepIndex] : null;
  const completedSteps = steps.filter(s =>
    s.status === 'success' || s.status === 'skipped' || (s.status === 'error' && s.canFail)
  ).length;

  return (
    <>
      {/* Loader overlay - fades out when complete */}
      {showLoader && (
        <div
          className={`fixed inset-0 z-50 bg-neutral-950 transition-all duration-700 ease-out ${
            isFadingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
        >
          <PathFinderLoader
            variant="fullscreen"
            caption={currentStep?.label || 'Initializing'}
            progress={overallProgress}
            currentStep={currentStep?.description}
            completedSteps={completedSteps}
            totalSteps={steps.length}
            error={isCriticalError ? errorMessage : undefined}
            detailedSteps={steps}
          />
        </div>
      )}

      {/* App content - always rendered, cross-fades in as loader fades out */}
      <div
        className={`transition-opacity duration-700 ease-out ${
          showLoader && !isFadingOut ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {children}
      </div>
    </>
  );
};
