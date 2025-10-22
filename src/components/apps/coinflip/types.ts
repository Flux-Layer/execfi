'use client';

import type { HISTORY_TABLE_HEADERS } from './constants';

export type CoinFaceSide = 'Heads' | 'Tails';

export type CoinFlipSessionStatus =
  | 'idle'
  | 'ready'
  | 'wagerRegistered'
  | 'flipped'
  | 'submitted';

export type FlipHistoryEntry = {
  id: number;
  sessionId: string | null;
  result: CoinFaceSide;
  guess: CoinFaceSide;
  bet: number;
  selectedMultiplier: number;
  payoutMultiplier: number;
  xp: number;
  timestamp: number;
  payoutTxHash?: string | null;
};

export type CoinFlipHistoryRecord = {
  id: number;
  sessionId: string | null;
  guess: string;
  outcome: string;
  wagerWei: string;
  selectedMultiplier: number;
  payoutMultiplier: number;
  xp: number;
  payoutTxHash?: string | null;
  createdAt: string;
};

export type RevealInfo = {
  serverSeed: string;
  clientSeed: string;
  serverSeedHash: string;
  outcome: CoinFaceSide;
};

export type RoundSummary = {
  guess: CoinFaceSide;
  outcome: CoinFaceSide;
  multiplierX100: number;
  xp: number;
  correct: boolean;
};

export type VerifySubject = RoundSummary & { sessionId: string | null };

export type OutcomeBanner = {
  win: boolean;
  outcome: CoinFaceSide;
  xp: number;
  payoutText?: string;
  cashoutHash?: string;
  className: string;
  message: string;
};

export type HistoryTableHeader = (typeof HISTORY_TABLE_HEADERS)[number];
