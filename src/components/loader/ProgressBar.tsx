"use client";

interface ProgressBarProps {
  progress: number; // 0-100
  error?: boolean;
}

export const ProgressBar = ({ progress, error }: ProgressBarProps) => {
  return (
    <div className="w-[400px] max-w-[80vw]">
      {/* Progress track */}
      <div className="relative h-2 bg-neutral-800/50 rounded-full overflow-hidden backdrop-blur-sm">
        {/* Progress fill */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
            error
              ? 'bg-gradient-to-r from-red-500 to-red-600'
              : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-magenta-500'
          }`}
          style={{
            width: `${progress}%`,
            boxShadow: error
              ? '0 0 20px rgba(239, 68, 68, 0.5)'
              : '0 0 20px rgba(0, 255, 255, 0.5)'
          }}
        />

        {/* Shimmer effect */}
        {!error && progress < 100 && (
          <div
            className="absolute inset-0 shimmer-effect"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
            }}
          />
        )}
      </div>

      {/* Percentage text */}
      <div className="text-center mt-2">
        <span className={`text-xs font-mono ${error ? 'text-red-400' : 'text-cyan-400/80'}`}>
          {progress}%
        </span>
      </div>
    </div>
  );
};
