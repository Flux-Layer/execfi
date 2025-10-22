'use client';

import type { TargetAndTransition, Variants } from 'framer-motion';
import { TbCrown, TbFeather } from 'react-icons/tb';

export const COIN_VARIANTS = {
  heads: {
    rotateX: 0,
    rotateY: 0,
    scale: 1,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  tails: {
    rotateX: 0,
    rotateY: 180,
    scale: 1,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  flipping: {
    rotateX: [0, 360, 720],
    rotateY: [0, 180, 360],
    scale: [1, 1.15, 1],
    transition: { duration: 0.9, ease: 'easeInOut' },
  },
} satisfies Variants;

export type CoinVariantKey = keyof typeof COIN_VARIANTS;

export const FLOAT_IDLE_ANIMATION: TargetAndTransition = {
  y: [0, -4, 0],
  rotateZ: [0, -1.5, 0.5, 0],
  transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
};

export const FLOAT_FLIP_ANIMATION: TargetAndTransition = {
  y: [0, -18, -12, 0],
  rotateZ: [0, -6, 6, 0],
  transition: { duration: 0.9, ease: 'easeInOut' },
};

export const COIN_FACE_THEMES = {
  Heads: {
    label: 'Heads',
    tagline: 'ExecFi Labs',
    Icon: TbCrown,
    labelTextClass: 'text-emerald-200',
    topLabelClass: 'text-emerald-100/85',
    taglineClass: 'text-emerald-100/70',
    accentRingClass: 'border-emerald-300/60',
    accentGlowClass: 'shadow-[0_0_26px_rgba(16,185,129,0.35)]',
    emblemBgClass:
      'bg-[radial-gradient(circle_at_40%_25%,rgba(134,239,172,0.9),rgba(16,185,129,0.45)_55%,rgba(6,95,70,0.85))]',
    emblemTextClass: 'text-emerald-50',
  },
  Tails: {
    label: 'Tails',
    tagline: 'Tails',
    Icon: TbFeather,
    labelTextClass: 'text-amber-200',
    topLabelClass: 'text-amber-100/85',
    taglineClass: 'text-amber-100/70',
    accentRingClass: 'border-amber-300/60',
    accentGlowClass: 'shadow-[0_0_26px_rgba(249,115,22,0.35)]',
    emblemBgClass:
      'bg-[radial-gradient(circle_at_40%_25%,rgba(253,230,138,0.85),rgba(249,115,22,0.45)_55%,rgba(120,53,15,0.9))]',
    emblemTextClass: 'text-amber-50',
  },
} as const;

export const COIN_RIDGE_COUNT = 72;

export const MAX_HISTORY_ENTRIES = 100;

export const HISTORY_TABLE_HEADERS = [
  'ID',
  'Date',
  'Status',
  'Bet',
  'Result',
  'Multiplier',
  'Payout',
  'Tx',
  'XP',
  'Outcome',
  'Verify',
] as const;

export const COINFACE_BACKDROP =
  'bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-950';
