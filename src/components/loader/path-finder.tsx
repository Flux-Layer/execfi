"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { LoadingStep } from '@/context/LoadingContext';
import { ProgressBar } from './ProgressBar';
import { DetailedStepsPanel } from './DetailedStepsPanel';

type LoaderVariant = 'fullscreen' | 'inline';

interface PathFinderLoaderProps {
  caption?: string;
  variant?: LoaderVariant;
  progress?: number; // 0-100
  currentStep?: string; // Current step description
  completedSteps?: number;
  totalSteps?: number;
  error?: string; // Error message if critical failure
  detailedSteps?: LoadingStep[]; // All steps for detailed view
}

export const PathFinderLoader = ({
  caption = "Initializing",
  variant = 'fullscreen',
  progress = 0,
  currentStep,
  completedSteps = 0,
  totalSteps = 10,
  error,
  detailedSteps
}: PathFinderLoaderProps) => {
  if (variant === 'fullscreen') {
    return (
      <div className="relative h-screen w-screen bg-neutral-950 overflow-hidden">
        {/* Background perspective grid */}
        <div className="absolute inset-0 opacity-20">
          <div className="perspective-grid" />
        </div>

        {/* Scanline effect */}
        <div className="scanline" />

        {/* Particle field */}
        <ParticleField />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-8">
          {/* Main spinner */}
          <PathFinder caption={caption} progress={progress} />

          {/* Progress bar */}
          <ProgressBar progress={progress} error={!!error} />

          {/* Current step indicator */}
          {currentStep && !error && (
            <div className="text-center space-y-2 max-w-md px-4">
              <p className="text-sm text-cyan-400/80 font-mono animate-pulse">
                {currentStep}
              </p>
              <p className="text-xs text-gray-500 font-mono">
                Step {completedSteps + 1} of {totalSteps}
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="text-center space-y-3 max-w-md px-4">
              <div className="text-red-400 font-mono text-sm">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold">Initialization Failed</span>
                </div>
                <p className="text-xs text-red-300/80">{error}</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-300 rounded font-mono text-xs hover:bg-red-500/30 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Detailed steps (expandable) */}
          {detailedSteps && (
            <DetailedStepsPanel steps={detailedSteps} />
          )}
        </div>
      </div>
    );
  }

  // Inline variant: fill parent (e.g., terminal card body)
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 grid place-content-center">
        <PathFinder caption={caption} progress={progress} />
      </div>
    </div>
  );
};

// Particle system for floating digital elements
const ParticleField = () => {
  const [particles, setParticles] = useState<
    Array<{
      id: number;
      x: number;
      y: number;
      size: number;
      duration: number;
      delay: number;
    }>
  >([]);

  useEffect(() => {
    const generated = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 10 + 10,
      delay: Math.random() * 5,
    }));
    setParticles(generated);
  }, []);

  if (particles.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute particle-float"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
};

export const PathFinder = ({ caption, progress = 0 }: { caption?: string; progress?: number }) => {
  // Calculate ring opacity based on progress
  const outerRingOpacity = Math.min(1, progress / 33);
  const middleRingOpacity = Math.min(1, Math.max(0, (progress - 33) / 33));
  const innerRingOpacity = Math.min(1, Math.max(0, (progress - 66) / 34));

  return (
    <div className="relative w-[400px] h-[400px] max-w-[80vmin] max-h-[80vmin]">
      {/* Outer glow backdrop */}
      <div className="absolute inset-0 rounded-full blur-3xl bg-gradient-to-r from-cyan-500/30 via-blue-500/30 to-magenta-500/30 animate-pulse-glow" />

      {/* SVG Spinner Rings */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 200 200"
        style={{ filter: 'drop-shadow(0 0 20px rgba(0, 255, 255, 0.5))' }}
      >
        <defs>
          {/* Gradient definitions */}
          <linearGradient id="cyanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00ffff" stopOpacity="1" />
            <stop offset="100%" stopColor="#00ffff" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7df9ff" stopOpacity="1" />
            <stop offset="100%" stopColor="#7df9ff" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="magentaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff00ff" stopOpacity="1" />
            <stop offset="100%" stopColor="#ff00ff" stopOpacity="0.3" />
          </linearGradient>

          {/* Glow filters */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Outer ring - fades in 0-33% */}
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke="url(#cyanGradient)"
          strokeWidth="3"
          strokeDasharray="160 340"
          strokeLinecap="round"
          className="animate-spin-slow"
          filter="url(#glow)"
          opacity={outerRingOpacity}
        />

        {/* Middle ring - fades in 33-66% */}
        <circle
          cx="100"
          cy="100"
          r="58"
          fill="none"
          stroke="url(#blueGradient)"
          strokeWidth="3"
          strokeDasharray="120 240"
          strokeLinecap="round"
          className="animate-spin-reverse"
          filter="url(#glow)"
          opacity={middleRingOpacity}
        />

        {/* Inner ring - fades in 66-100% */}
        <circle
          cx="100"
          cy="100"
          r="36"
          fill="none"
          stroke="url(#magentaGradient)"
          strokeWidth="3"
          strokeDasharray="80 145"
          strokeLinecap="round"
          className="animate-spin-fast"
          filter="url(#glow)"
          opacity={innerRingOpacity}
        />

        {/* Center pulsing dot - always visible */}
        <circle
          cx="100"
          cy="100"
          r="4"
          fill="white"
          className="animate-pulse"
          filter="url(#glow)"
        />

        {/* Orbital dots - fade in progressively */}
        <circle
          cx="100"
          cy="20"
          r="3"
          fill="#00ffff"
          className="animate-orbit-1"
          filter="url(#glow)"
          opacity={outerRingOpacity}
        />
        <circle
          cx="142"
          cy="100"
          r="2.5"
          fill="#7df9ff"
          className="animate-orbit-2"
          filter="url(#glow)"
          opacity={middleRingOpacity}
        />
        <circle
          cx="100"
          cy="164"
          r="2"
          fill="#ff00ff"
          className="animate-orbit-3"
          filter="url(#glow)"
          opacity={innerRingOpacity}
        />
      </svg>

      {/* Hexagon decorative elements */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="hexagon-container animate-spin-very-slow"
          style={{ opacity: progress / 100 }}
        >
          <HexagonRing />
        </div>
      </div>

      {/* Caption text */}
      {caption && (
        <div className="absolute inset-0 grid place-content-center pointer-events-none z-20">
          <div className="text-base font-mono tracking-[0.3em] uppercase select-none neon-cyber animate-fadePulse mt-32">
            {caption}
          </div>
        </div>
      )}
    </div>
  );
};

// Hexagonal decorative ring
const HexagonRing = () => {
  return (
    <svg width="180" height="180" viewBox="0 0 100 100" className="opacity-30">
      <polygon
        points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5"
        fill="none"
        stroke="#00ffff"
        strokeWidth="0.5"
        strokeDasharray="3 3"
      />
      <polygon
        points="50,15 80,32.5 80,67.5 50,85 20,67.5 20,32.5"
        fill="none"
        stroke="#7df9ff"
        strokeWidth="0.5"
        strokeDasharray="3 3"
      />
    </svg>
  );
};

export default PathFinderLoader;
