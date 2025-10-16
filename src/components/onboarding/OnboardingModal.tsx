'use client';

import React, { useState } from 'react';
import { FiX, FiChevronRight, FiSkipForward } from 'react-icons/fi';
import type { OnboardingStep } from '@/lib/onboarding/types';
import { useOnboarding } from '@/context/OnboardingContext';
import { getNextStep } from '@/lib/onboarding/config';

interface OnboardingModalProps {
  step: OnboardingStep;
}

export function OnboardingModal({ step }: OnboardingModalProps) {
  const { completeStep, skipOnboarding, state } = useOnboarding();
  const [isExiting, setIsExiting] = useState(false);

  if (!state) return null;

  const isLastStep = step.order === state.totalSteps;

  const handleNext = async () => {
    // Trigger exit animation
    setIsExiting(true);

    // Wait for exit animation to complete
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Complete the step
    await completeStep(step.id);
  };

  const handleSkip = async () => {
    if (step.skippable) {
      // Trigger exit animation
      setIsExiting(true);

      // Wait for exit animation to complete
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Skip onboarding
      await skipOnboarding();
    }
  };

  const nextStep = getNextStep(step.id);

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md px-4 ${isExiting ? 'animate-fadeOut' : 'animate-fadeIn'}`}>
      <div
        className={`relative w-full max-w-2xl rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl shadow-emerald-500/10 ${isExiting ? 'animate-slideDown' : 'animate-slideUp'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button (only if skippable) */}
        {step.skippable && (
          <button
            type="button"
            onClick={handleSkip}
            className="absolute right-4 top-4 rounded-full border border-slate-700 bg-slate-900/70 p-2 text-slate-400 transition-all hover:border-emerald-400/40 hover:text-emerald-200 hover:scale-110"
            aria-label="Skip onboarding"
          >
            <FiX className="h-4 w-4" />
          </button>
        )}

        {/* Progress bar */}
        <div className="px-8 pt-6">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-mono">
              Step {step.order} of {state.totalSteps}
            </span>
            <span className="font-mono font-semibold text-emerald-400">
              {state.progress}%
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-1.5 rounded-full transition-all duration-500 ease-out shadow-lg shadow-emerald-500/50"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {/* Category badge */}
          <div className="mb-4">
            <span className="inline-block px-3 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              {step.category}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            {step.title}
          </h2>

          {/* Description */}
          <p className="text-base text-slate-300 leading-relaxed mb-6">
            {step.description}
          </p>

          {/* Optional image */}
          {step.image && (
            <div className="mb-6 rounded-lg overflow-hidden border border-slate-700">
              <img
                src={step.image}
                alt={step.title}
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          )}

          {/* Optional video */}
          {step.video && (
            <div className="mb-6 rounded-lg overflow-hidden border border-slate-700 aspect-video">
              <video
                src={step.video}
                controls
                className="w-full h-full"
                preload="metadata"
              >
                Your browser does not support video playback.
              </video>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-8 pb-6 flex items-center justify-between gap-4">
          {/* Skip button */}
          {step.skippable && (
            <button
              type="button"
              onClick={handleSkip}
              className="group flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
            >
              <FiSkipForward className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              Skip Tutorial
            </button>
          )}

          <div className="flex-1" />

          {/* Next button */}
          <button
            type="button"
            onClick={handleNext}
            className="group relative px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold text-sm shadow-lg shadow-emerald-500/30 transition-all hover:shadow-emerald-500/50 hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            {isLastStep ? "Let's Go!" : 'Next'}
            {!isLastStep && (
              <FiChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            )}
          </button>
        </div>

        {/* Next step preview (if not last step) */}
        {!isLastStep && nextStep && (
          <div className="px-8 pb-6 pt-2 border-t border-slate-800/50">
            <p className="text-xs text-slate-500">
              Next: <span className="text-slate-400">{nextStep.title}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
