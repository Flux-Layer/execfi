'use client';

import React from 'react';
import { useOnboarding } from '@/context/OnboardingContext';
import { OnboardingModal } from './OnboardingModal';
import { OnboardingSpotlight } from './OnboardingSpotlight';

/**
 * OnboardingOrchestrator
 *
 * Main orchestrator component that determines which onboarding UI to show
 * based on the current step's component type.
 *
 * Supports:
 * - modal: Full-screen modal with step content
 * - spotlight: Highlights specific UI elements
 * - tooltip: Contextual tooltips (uses spotlight for now)
 * - tour: Guided multi-step tour (uses spotlight for now)
 */
export function OnboardingOrchestrator() {
  const { showOnboarding, currentStep, loading } = useOnboarding();

  // Don't show anything while loading
  if (loading) {
    return null;
  }

  // Don't show if onboarding is not active
  if (!showOnboarding || !currentStep) {
    return null;
  }

  // Determine which component to render based on step.component
  const componentType = currentStep.component || 'modal';

  switch (componentType) {
    case 'modal':
      return <OnboardingModal key={currentStep.id} step={currentStep} />;

    case 'spotlight':
      // Spotlight requires a target element
      if (!currentStep.target) {
        console.warn(
          `[OnboardingOrchestrator] Spotlight component requires a target selector for step: ${currentStep.id}`
        );
        return <OnboardingModal key={currentStep.id} step={currentStep} />;
      }
      return <OnboardingSpotlight key={currentStep.id} step={currentStep} />;

    case 'tooltip':
      // Tooltip uses spotlight implementation for now
      if (!currentStep.target) {
        console.warn(
          `[OnboardingOrchestrator] Tooltip component requires a target selector for step: ${currentStep.id}`
        );
        return <OnboardingModal key={currentStep.id} step={currentStep} />;
      }
      return <OnboardingSpotlight key={currentStep.id} step={currentStep} />;

    case 'tour':
      // Tour uses spotlight implementation for now
      // Can be enhanced later with more complex multi-step tour UI
      if (!currentStep.target) {
        console.warn(
          `[OnboardingOrchestrator] Tour component requires a target selector for step: ${currentStep.id}`
        );
        return <OnboardingModal key={currentStep.id} step={currentStep} />;
      }
      return <OnboardingSpotlight key={currentStep.id} step={currentStep} />;

    default:
      // Fallback to modal
      console.warn(
        `[OnboardingOrchestrator] Unknown component type: ${componentType}, falling back to modal`
      );
      return <OnboardingModal key={currentStep.id} step={currentStep} />;
  }
}
