'use client';
import React from 'react';
import { useOnboarding } from '@/context/OnboardingContext';
import { TUTORIAL_STEPS } from '@/lib/tutorial/config';

export function TutorialModal() {
  const { state, showTutorial, completeStep, completeTutorial, skipTutorial } = useOnboarding();

  if (!showTutorial || !state?.currentStep) return null;

  const step = TUTORIAL_STEPS.find(s => s.id === state.currentStep);
  if (!step) return null;

  const isLastStep = step.order === TUTORIAL_STEPS.length;

  const handleNext = async () => {
    await completeStep(step.id);
    if (isLastStep) await completeTutorial();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6 border border-gray-200 dark:border-gray-700">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Step {step.order} of {TUTORIAL_STEPS.length}</span>
            <span>{state.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${state.progress}%` }} 
            />
          </div>
        </div>

        {/* Content */}
        <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
          {step.title}
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
          {step.description}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          {step.skippable && (
            <button 
              onClick={skipTutorial}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Skip Tutorial
            </button>
          )}
          <button 
            onClick={handleNext}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            {isLastStep ? 'Get Started!' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
