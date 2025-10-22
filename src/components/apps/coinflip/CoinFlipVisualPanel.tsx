'use client';

import clsx from 'clsx';
import { motion, type TargetAndTransition } from 'framer-motion';
import { TbCrown, TbFeather } from 'react-icons/tb';
import { COIN_RIDGE_COUNT, COIN_VARIANTS, type CoinVariantKey } from './constants';
import type { CoinFaceSide, RoundSummary } from './types';
import { CoinFace } from './CoinFace';

type CoinFlipVisualPanelProps = {
  isFlipping: boolean;
  coinFloatAnimation: TargetAndTransition;
  activeVariant: CoinVariantKey;
  userChoice: CoinFaceSide;
  onSelectChoice: (choice: CoinFaceSide) => void;
  statusTone: string;
  statusMessage: string | null;
  balanceDisplay: string | null;
  targetChainLabel: string;
  needsChainSwitch: boolean;
  onSwitchChain: () => Promise<void> | void;
  isBalanceLoading: boolean;
  hasSufficientBalance: boolean;
  betValid: boolean;
  lastOutcome: { correct: boolean; guess: CoinFaceSide } | null;
  roundSummary: RoundSummary | null;
  multiplierValid: boolean;
  onFlip: () => Promise<void> | void;
};

export function CoinFlipVisualPanel({
  isFlipping,
  coinFloatAnimation,
  activeVariant,
  userChoice,
  onSelectChoice,
  statusTone,
  statusMessage,
  balanceDisplay,
  targetChainLabel,
  needsChainSwitch,
  onSwitchChain,
  isBalanceLoading,
  hasSufficientBalance,
  betValid,
  lastOutcome,
  roundSummary,
  multiplierValid,
  onFlip,
}: CoinFlipVisualPanelProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(17,94,89,0.35),rgba(5,12,11,0.95))] p-4 text-center shadow-[0_24px_65px_rgba(4,9,8,0.85)] sm:p-6">
      <div className="flex flex-col items-center gap-4">
        <div className="relative mx-auto aspect-square w-full max-w-[240px] sm:max-w-[280px]">
          <motion.div
            className="relative h-full w-full"
            animate={coinFloatAnimation}
            style={{ clipPath: 'circle(50% at 50% 50%)' }}
          >
            <motion.div
              animate={activeVariant}
              initial="heads"
              variants={COIN_VARIANTS}
              whileHover={
                isFlipping
                  ? undefined
                  : {
                      scale: 1.05,
                      rotateX: -6,
                      rotateY: 8,
                    }
              }
              transition={{ type: 'spring', stiffness: 160, damping: 18 }}
              className="relative h-full w-full overflow-hidden rounded-full border border-emerald-200/35 bg-[#061f1b] shadow-[0_18px_45px_rgba(0,0,0,0.45)] [transform-style:preserve-3d]"
              style={{ clipPath: 'circle(50% at 50% 50%)' }}
            >
              <div className="pointer-events-none absolute inset-0 rounded-full border border-white/8 bg-[radial-gradient(circle_at_35%_22%,rgba(255,255,255,0.35),rgba(17,24,39,0.92))]" />
              <div className="pointer-events-none absolute inset-[3%] rounded-full border border-white/10 bg-[conic-gradient(from_120deg,rgba(255,255,255,0.18)_0deg,rgba(255,255,255,0)_120deg,rgba(255,255,255,0)_240deg,rgba(255,255,255,0.18)_300deg)] opacity-70" />
              <div
                className="pointer-events-none absolute inset-[6%] rounded-full border border-emerald-400/15 bg-[radial-gradient(circle_at_50%_50%,rgba(16,94,89,0.38),rgba(2,24,21,0.92))] overflow-hidden"
                style={{ clipPath: 'circle(50% at 50% 50%)' }}
              >
                <div className="relative h-full w-full">
                  {Array.from({ length: COIN_RIDGE_COUNT }).map((_, index) => (
                    <span
                      key={index}
                      className="absolute left-1/2 top-1/2 h-[52%] w-[1.5px] origin-[50%_100%] rounded-full bg-gradient-to-b from-white/25 via-emerald-300/40 to-emerald-900/60 opacity-65"
                      style={{
                        transform: `rotate(${index * (360 / COIN_RIDGE_COUNT)}deg) translateY(-49%)`,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="pointer-events-none absolute inset-[9%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.1),rgba(255,255,255,0)_65%)] opacity-40" />
              <CoinFace side="Heads" />
              <CoinFace side="Tails" className="[transform:rotateY(180deg)]" />
              <motion.span
                aria-hidden
                className="pointer-events-none absolute -left-[45%] top-0 h-full w-[32%] skew-x-12 bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-0 mix-blend-screen"
                animate={{ opacity: [0, 1, 0], x: ['-40%', '140%'] }}
                transition={{ duration: isFlipping ? 0.9 : 2.6, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="pointer-events-none absolute inset-0 rounded-full border border-transparent shadow-[inset_0_0_12px_rgba(0,0,0,0.45)]" />
            </motion.div>
          </motion.div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {(['Heads', 'Tails'] as const).map((option) => {
            const isActive = userChoice === option;
            const SideIcon = option === 'Heads' ? TbCrown : TbFeather;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onSelectChoice(option)}
                disabled={isFlipping}
                className={clsx(
                  'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
                  isActive
                    ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.3)]'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:border-emerald-400/50 hover:text-emerald-200',
                )}
              >
                <SideIcon className="h-4 w-4" />
                <span>{option}</span>
              </button>
            );
          })}
        </div>
        <p className={clsx('text-sm text-center', statusTone)}>{statusMessage}</p>
        <p className="text-[11px] text-center text-slate-400">
          {balanceDisplay
            ? `${targetChainLabel} Balance: ${balanceDisplay}`
            : isBalanceLoading
            ? 'Fetching balance…'
            : 'Connect a wallet to view balance.'}
          {!hasSufficientBalance && betValid && (
            <span className="ml-2 rounded-full border border-rose-400/60 bg-rose-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-rose-200">
              Insufficient balance
            </span>
          )}
        </p>
        {needsChainSwitch && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                const result = onSwitchChain();
                if (result && typeof (result as Promise<void>).then === 'function') {
                  void (result as Promise<void>).catch(() => undefined);
                }
              }}
              className="rounded-full border border-amber-400/60 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20"
            >
              Switch to {targetChainLabel}
            </button>
          </div>
        )}
        {!isFlipping && lastOutcome && (
          <p
            className={clsx(
              'text-[11px] text-center uppercase tracking-wide',
              lastOutcome.correct ? 'text-emerald-400' : 'text-rose-300',
            )}
          >
            You guessed {lastOutcome.guess}
            {roundSummary ? ` · XP ${roundSummary.xp}` : ''}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <button
            type="button"
            disabled={isFlipping || !betValid || !multiplierValid}
            onClick={() => {
              void onFlip();
            }}
            className="rounded-full border border-emerald-400/60 bg-emerald-500/20 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFlipping ? 'Flipping…' : 'Flip coin'}
          </button>
        </div>
      </div>
    </section>
  );
}
