"use client";

import { LoadingStep } from '@/context/LoadingContext';

interface DetailedStepsPanelProps {
  steps: LoadingStep[];
}

export const DetailedStepsPanel = ({ steps }: DetailedStepsPanelProps) => {
  return (
    <div className="absolute top-4 left-4">
      <div className="flex flex-col gap-2">
        {steps.map((step) => (
          <StepBadge key={step.id} step={step} />
        ))}
      </div>
    </div>
  );
};

function StepBadge({ step }: { step: LoadingStep }) {
  return (
    <div className="flex items-center gap-3 text-sm font-mono px-3 py-1 transition-all duration-500 ease-out" data-step={step.id}>
      <BadgeIcon status={step.status} />
      <div className="flex-1 min-w-0">
        <div className={`font-semibold ${
          step.status === 'success' ? 'text-emerald-400' :
          step.status === 'error' ? 'text-red-400' :
          step.status === 'loading' ? 'text-cyan-300' :
          step.status === 'skipped' ? 'text-gray-500' :
          'text-gray-400'
        }`}>
          {step.label}
        </div>
        <div className="text-gray-500 text-xs mt-0.5 tracking-wide">
          {step.description}
        </div>
        {step.status === 'error' && step.error && (
          <div className="text-red-300/80 text-[10px] mt-0.5">
            {step.error.message}
          </div>
        )}
      </div>
      {step.endTime && step.startTime && (
        <div className="text-gray-600 text-[10px] whitespace-nowrap">
          {step.endTime - step.startTime}ms
        </div>
      )}
    </div>
  );
}

function BadgeIcon({ status }: { status: LoadingStep['status'] }) {
  if (status === 'success') {
    return (
      <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    );
  }

  if (status === 'error') {
    return (
      <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    );
  }

  if (status === 'skipped') {
    return (
      <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
      </svg>
    );
  }

  if (status === 'pending') {
    return (
      <div className="w-5 h-5 border-2 border-gray-600 rounded-full" />
    );
  }

  return (
    <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
  );
}
