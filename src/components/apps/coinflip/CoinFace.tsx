'use client';

import clsx from 'clsx';
import type { IconType } from 'react-icons';
import { COIN_FACE_THEMES } from './constants';
import type { CoinFaceSide } from './types';

type CoinFaceProps = {
  side: CoinFaceSide;
  className?: string;
};

export function CoinFace({ side, className }: CoinFaceProps) {
  const theme = COIN_FACE_THEMES[side];
  const Icon = theme.Icon as IconType;

  return (
    <div
      className={clsx(
        'absolute inset-0 z-10 flex flex-col items-center justify-between rounded-full px-5 py-6 [backface-visibility:hidden]',
        theme.labelTextClass,
        className,
      )}
    >
      <div className="flex w-full items-center gap-2">
        <span className="h-px flex-1 rounded-full bg-current/25" />
        <span
          className={clsx(
            'text-[10px] font-semibold uppercase tracking-[0.38em] drop-shadow-sm',
            theme.topLabelClass,
          )}
        >
          {theme.label}
        </span>
        <span className="h-px flex-1 rounded-full bg-current/25" />
      </div>
      <div
        className={clsx(
          'relative flex h-14 w-14 items-center justify-center rounded-full border bg-slate-900/80 backdrop-blur-[1px]',
          theme.accentRingClass,
          theme.accentGlowClass,
        )}
      >
        <div className={clsx('absolute inset-0 rounded-full opacity-90', theme.emblemBgClass)} />
        <div className="absolute inset-[12%] rounded-full border border-white/12 opacity-40" />
        <div className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle_at_48%_36%,rgba(255,255,255,0.24),rgba(255,255,255,0)_65%)] opacity-60" />
        <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(255,255,255,0.08)_0deg,rgba(255,255,255,0)_30deg,rgba(255,255,255,0)_180deg,rgba(255,255,255,0.1)_210deg,rgba(255,255,255,0)_360deg)] opacity-55" />
        <Icon aria-hidden className={clsx('relative z-10 h-7 w-7 drop-shadow', theme.emblemTextClass)} />
      </div>
      <div className="flex w-full items-center gap-2">
        <span className="h-px flex-1 rounded-full bg-current/20" />
        <span
          className={clsx('text-[9px] uppercase tracking-[0.22em]', theme.taglineClass)}
        >
          {theme.tagline}
        </span>
        <span className="h-px flex-1 rounded-full bg-current/20" />
      </div>
    </div>
  );
}
