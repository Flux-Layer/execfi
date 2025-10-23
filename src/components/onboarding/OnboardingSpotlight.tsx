'use client';

import React, { useEffect, useState, useRef } from 'react';
import { FiChevronRight, FiSkipForward, FiInfo } from 'react-icons/fi';
import type { OnboardingStep } from '@/lib/onboarding/types';
import { useOnboarding } from '@/context/OnboardingContext';

interface OnboardingSpotlightProps {
  step: OnboardingStep;
}

interface ElementPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingSpotlight({ step }: OnboardingSpotlightProps) {
  const { completeStep, skipOnboarding, state } = useOnboarding();
  const [elementPos, setElementPos] = useState<ElementPosition | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom' | 'left' | 'right'>(
    'bottom'
  );
  const [showFallback, setShowFallback] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const observerRef = useRef<MutationObserver | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (!step.target) return;

    // Reset scroll flag for new step
    hasScrolledRef.current = false;

    // Set a timeout - if element not found in 3 seconds, show fallback message
    timeoutRef.current = setTimeout(() => {
      if (!elementPos) {
        setShowFallback(true);
      }
    }, 3000);

    const updatePosition = () => {
      const element = document.querySelector(step.target!) as HTMLElement;
      if (element) {
        const rect = element.getBoundingClientRect();
        const newPos = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };

        // Only update if position has changed (prevent infinite loop)
        setElementPos((prevPos) => {
          if (
            !prevPos ||
            Math.abs(prevPos.top - newPos.top) > 1 ||
            Math.abs(prevPos.left - newPos.left) > 1 ||
            Math.abs(prevPos.width - newPos.width) > 1 ||
            Math.abs(prevPos.height - newPos.height) > 1
          ) {
            return newPos;
          }
          return prevPos;
        });

        // Clear timeout if element is found
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        // Determine best tooltip position
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        if (rect.bottom + 300 > viewportHeight) {
          setTooltipPosition('top');
        } else if (rect.top < 300) {
          setTooltipPosition('bottom');
        } else if (rect.left < 400) {
          setTooltipPosition('right');
        } else if (rect.right + 400 > viewportWidth) {
          setTooltipPosition('left');
        } else {
          setTooltipPosition('bottom');
        }

        // Scroll element into view (only once)
        if (!hasScrolledRef.current) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          hasScrolledRef.current = true;
        }
      }
    };

    // Initial position
    updatePosition();

    // Update on resize and scroll
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    // Watch for DOM changes
    observerRef.current = new MutationObserver(updatePosition);
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      observerRef.current?.disconnect();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [step.target]);

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

  if (!elementPos) {
    // Show loading for first 3 seconds
    if (!showFallback) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
          <div className="text-slate-300">Loading...</div>
        </div>
      );
    }

    // After timeout, show helpful message with action hint
    return (
      <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm px-4 ${isExiting ? 'animate-fadeOut' : 'animate-fadeIn'}`}>
        <div className={`relative max-w-md rounded-xl border border-amber-500/30 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl shadow-amber-500/20 ${isExiting ? 'animate-slideDown' : 'animate-slideUp'}`}>
          {/* Progress indicator */}
          <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono">
              {step.order} / {state.totalSteps}
            </span>
            <span className="font-mono font-semibold text-amber-400">{state.progress}%</span>
          </div>

          {/* Warning Icon */}
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-amber-500/10 p-3 border border-amber-500/20">
              <FiInfo className="h-8 w-8 text-amber-400" />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-white mb-2 text-center">{step.title}</h3>

          {/* Description */}
          <p className="text-sm text-slate-300 leading-relaxed mb-4">{step.description}</p>

          {/* Helpful hint for terminal steps */}
          {step.category === 'terminal' && step.id !== 'terminal-intro' && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <p className="text-xs text-amber-200 leading-relaxed">
                💡 <strong>Hint:</strong> This step requires the Terminal to be open. Click the Terminal icon in the dock (bottom of the screen) to continue.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            {step.skippable && (
              <button
                type="button"
                onClick={handleSkip}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <FiSkipForward className="h-3.5 w-3.5" />
                Skip Tutorial
              </button>
            )}

            <div className="flex-1" />

            <button
              type="button"
              onClick={handleNext}
              className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold text-sm shadow-lg shadow-emerald-500/30 transition-all hover:shadow-emerald-500/50 hover:scale-105"
            >
              {isLastStep ? 'Done' : 'Next'}
              {!isLastStep && (
                <FiChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Overlay with spotlight cutout */}
      <div className={`fixed inset-0 z-[100] pointer-events-none ${isExiting ? 'animate-fadeOut' : ''}`}>
        {/* Top overlay */}
        <div
          className="absolute left-0 right-0 bg-slate-950/90 backdrop-blur-sm transition-all duration-300"
          style={{ top: 0, height: `${elementPos.top}px` }}
        />

        {/* Left overlay */}
        <div
          className="absolute top-0 bottom-0 bg-slate-950/90 backdrop-blur-sm transition-all duration-300"
          style={{ left: 0, width: `${elementPos.left}px` }}
        />

        {/* Right overlay */}
        <div
          className="absolute top-0 bottom-0 bg-slate-950/90 backdrop-blur-sm transition-all duration-300"
          style={{ left: `${elementPos.left + elementPos.width}px`, right: 0 }}
        />

        {/* Bottom overlay */}
        <div
          className="absolute left-0 right-0 bg-slate-950/90 backdrop-blur-sm transition-all duration-300"
          style={{ top: `${elementPos.top + elementPos.height}px`, bottom: 0 }}
        />

        {/* Spotlight ring */}
        <div
          className={`absolute rounded-lg border-2 border-emerald-400 shadow-lg shadow-emerald-500/50 transition-all duration-300 ${isExiting ? 'opacity-0' : 'animate-pulse'}`}
          style={{
            top: `${elementPos.top - 8}px`,
            left: `${elementPos.left - 8}px`,
            width: `${elementPos.width + 16}px`,
            height: `${elementPos.height + 16}px`,
          }}
        />
      </div>

      {/* Tooltip */}
      <div
        className={`fixed z-[100] pointer-events-auto ${isExiting ? 'animate-fadeOut' : 'animate-fadeIn'}`}
        style={getTooltipStyle(elementPos, tooltipPosition)}
      >
        <div className="relative max-w-md rounded-xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl shadow-emerald-500/20">
          {/* Arrow */}
          <div
            className="absolute w-4 h-4 bg-slate-900 border-emerald-500/30 rotate-45"
            style={getArrowStyle(tooltipPosition)}
          />

          {/* Progress indicator */}
          <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono">
              {step.order} / {state.totalSteps}
            </span>
            <span className="font-mono font-semibold text-emerald-400">{state.progress}%</span>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>

          {/* Description */}
          <p className="text-sm text-slate-300 leading-relaxed mb-4">{step.description}</p>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            {step.skippable && (
              <button
                type="button"
                onClick={handleSkip}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <FiSkipForward className="h-3.5 w-3.5" />
                Skip
              </button>
            )}

            <div className="flex-1" />

            <button
              type="button"
              onClick={handleNext}
              className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold text-sm shadow-lg shadow-emerald-500/30 transition-all hover:shadow-emerald-500/50 hover:scale-105"
            >
              {isLastStep ? 'Done' : 'Next'}
              {!isLastStep && (
                <FiChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function getTooltipStyle(
  elementPos: ElementPosition,
  position: 'top' | 'bottom' | 'left' | 'right'
): React.CSSProperties {
  const offset = 24;

  switch (position) {
    case 'top':
      return {
        top: `${elementPos.top - offset}px`,
        left: `${elementPos.left + elementPos.width / 2}px`,
        transform: 'translate(-50%, -100%)',
      };
    case 'bottom':
      return {
        top: `${elementPos.top + elementPos.height + offset}px`,
        left: `${elementPos.left + elementPos.width / 2}px`,
        transform: 'translateX(-50%)',
      };
    case 'left':
      return {
        top: `${elementPos.top + elementPos.height / 2}px`,
        left: `${elementPos.left - offset}px`,
        transform: 'translate(-100%, -50%)',
      };
    case 'right':
      return {
        top: `${elementPos.top + elementPos.height / 2}px`,
        left: `${elementPos.left + elementPos.width + offset}px`,
        transform: 'translateY(-50%)',
      };
  }
}

function getArrowStyle(position: 'top' | 'bottom' | 'left' | 'right'): React.CSSProperties {
  switch (position) {
    case 'top':
      return {
        bottom: '-8px',
        left: '50%',
        transform: 'translateX(-50%)',
        borderTop: '1px solid rgba(16, 185, 129, 0.3)',
        borderLeft: '1px solid rgba(16, 185, 129, 0.3)',
      };
    case 'bottom':
      return {
        top: '-8px',
        left: '50%',
        transform: 'translateX(-50%)',
        borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
        borderRight: '1px solid rgba(16, 185, 129, 0.3)',
      };
    case 'left':
      return {
        right: '-8px',
        top: '50%',
        transform: 'translateY(-50%)',
        borderTop: '1px solid rgba(16, 185, 129, 0.3)',
        borderRight: '1px solid rgba(16, 185, 129, 0.3)',
      };
    case 'right':
      return {
        left: '-8px',
        top: '50%',
        transform: 'translateY(-50%)',
        borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
        borderLeft: '1px solid rgba(16, 185, 129, 0.3)',
      };
  }
}
