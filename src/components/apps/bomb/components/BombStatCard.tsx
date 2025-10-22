'use client';

interface BombStatCardProps {
  icon: string;
  label: string;
  value: string | number;
  subvalue?: string;
  trend?: 'up' | 'down' | 'neutral';
  isLoading?: boolean;
}

export function BombStatCard({
  icon,
  label,
  value,
  subvalue,
  trend,
  isLoading,
}: BombStatCardProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg border border-gray-700 bg-gray-800 p-4">
        <div className="h-4 w-16 rounded bg-gray-700" />
        <div className="mt-2 h-8 w-24 rounded bg-gray-700" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4 transition-all hover:border-gray-600">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl" role="img" aria-hidden="true">
              {icon}
            </span>
            <p className="text-sm text-gray-400">{label}</p>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-100">{value}</p>
          {subvalue && (
            <p className="mt-1 text-xs text-gray-500">{subvalue}</p>
          )}
        </div>
        {trend && <TrendIndicator trend={trend} />}
      </div>
    </div>
  );
}

// Trend Indicator
function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  const config = {
    up: { icon: '↑', className: 'text-green-400' },
    down: { icon: '↓', className: 'text-red-400' },
    neutral: { icon: '→', className: 'text-gray-400' },
  };

  const { icon, className } = config[trend];

  return (
    <span className={`text-xl font-bold ${className}`} aria-label={`Trend: ${trend}`}>
      {icon}
    </span>
  );
}
