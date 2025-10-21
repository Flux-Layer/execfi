"use client";

import { useState } from 'react';
import { LoadingStep } from '@/context/LoadingContext';

interface DetailedStepsPanelProps {
  steps: LoadingStep[];
}

export const DetailedStepsPanel = ({ steps }: DetailedStepsPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[500px] max-w-[90vw]">
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 bg-neutral-900/80 backdrop-blur-sm border border-cyan-500/30 rounded-t-lg text-cyan-400 font-mono text-xs hover:bg-neutral-900/90 transition-colors flex items-center justify-between"
      >
        <span>{isExpanded ? 'Hide' : 'Show'} Details</span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Steps list */}
      {isExpanded && (
        <div className="bg-neutral-900/90 backdrop-blur-sm border border-cyan-500/30 border-t-0 rounded-b-lg max-h-[300px] overflow-y-auto scrollbar-hide">
          <div className="p-4 space-y-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className="flex items-center gap-3 text-xs font-mono"
                data-step={step.id}
              >
                {/* Status icon */}
                <div className="flex-shrink-0 w-5 h-5">
                  {step.status === 'success' && (
                    <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                  {step.status === 'loading' && (
                    <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  )}
                  {step.status === 'error' && (
                    <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  {step.status === 'skipped' && (
                    <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                  )}
                  {step.status === 'pending' && (
                    <div className="w-5 h-5 border-2 border-gray-600 rounded-full" />
                  )}
                </div>

                {/* Step info */}
                <div className="flex-1 min-w-0">
                  <div className={`font-medium ${
                    step.status === 'success' ? 'text-green-400' :
                    step.status === 'error' ? 'text-red-400' :
                    step.status === 'loading' ? 'text-cyan-400' :
                    step.status === 'skipped' ? 'text-gray-500' :
                    'text-gray-600'
                  }`}>
                    {step.label}
                  </div>
                  {step.status === 'loading' && (
                    <div className="text-gray-500 text-[10px] mt-0.5">
                      {step.description}
                    </div>
                  )}
                  {step.status === 'error' && step.error && (
                    <div className="text-red-300/80 text-[10px] mt-0.5">
                      {step.error.message}
                    </div>
                  )}
                </div>

                {/* Duration */}
                {step.endTime && step.startTime && (
                  <div className="text-gray-500 text-[10px] whitespace-nowrap">
                    {step.endTime - step.startTime}ms
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
