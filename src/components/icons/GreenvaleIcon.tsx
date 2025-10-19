import clsx from "clsx";

type GreenvaleIconProps = {
  className?: string;
};

/**
 * Simple SVG icon evoking a farmer planting seedlings.
 */
export default function GreenvaleIcon({ className }: GreenvaleIconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label="Greenvale planting icon"
      className={clsx("h-6 w-6 text-emerald-300", className)}
    >
      <defs>
        <linearGradient id="soil" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect x="4" y="28" width="40" height="12" rx="4" fill="url(#soil)" />
      <path
        d="M16 20c1.5 0 4.1 3.7 4 8-.1 4.4-2 7.8-4 10-2-2.2-3.9-5.6-4-10-.1-4.3 2.5-8 4-8z"
        fill="currentColor"
        fillOpacity="0.75"
      />
      <path
        d="M32 16c1.7 0 4.7 4.2 4 9-.6 4.6-3.3 8.2-6 10.6-2.7-2.4-5.4-6-6-10.6-.7-4.8 2.3-9 4-9z"
        fill="currentColor"
        fillOpacity="0.65"
      />
      <circle cx="18" cy="14" r="4" fill="#f3d08a" />
      <path
        d="M14 32c3 2.5 7 3.6 11 3.5"
        stroke="#f3f4f6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26 28c3.2 1.4 7.3 1.4 11 0"
        stroke="#f3f4f6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 12c2-1.5 4.5-2.3 7-2.2"
        stroke="#f3f4f6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
