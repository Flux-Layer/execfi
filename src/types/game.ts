/**
 * Game types for Degenshoot
 * Includes session data, history items, and statistics
 */

export interface GameSession {
  id: string;
  userAddress: string | null;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  createdAt: bigint;
  wagerWei: string | null;
  nonceBase: number;
  status: GameStatus;
  rows: RowMetadata[];
  currentRow: number;
  currentMultiplier: number;
  completedRows: number;
  lockedTileCounts: number[];
  roundSummary: RoundSummary | null;
  finalizedAt: bigint | null;
  expiresAt: Date;
  isActive: boolean;
  updatedAt: Date;

  // Transaction tracking fields
  wagerTxHash: string | null;
  resultTxHash: string | null;
  xpTxHash: string | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
}

export type GameStatus =
  | 'active'
  | 'completed'
  | 'lost'
  | 'revealed'
  | 'submitted';

export interface RowMetadata {
  rowIndex: number;
  nonce: number;
  fairHash: string;
  bombPosition: number;
  selectedTile: number | null;
  timestamp: number;
}

export interface RoundSummary {
  xp: number;
  kills: number;
  timeAlive: number;
  score: number;
  multiplier: number;
  completedRows: number;
}

// History display types
export interface GameHistoryItem {
  id: string;
  date: Date;
  status: GameStatus;
  betAmount: string;        // ETH formatted
  result: 'win' | 'loss' | 'active';
  multiplier: number;
  rows: number;
  payoutTxHash: string | null;
  withdrawTxHash: string | null;  // Cashout transaction hash
  serverSeedHash: string;
  serverSeed: string | null;
  isVerified: boolean;
  canVerify: boolean;
}

export interface GameHistoryResponse {
  items: GameHistoryItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Statistics types
export interface UserStatistics {
  totalWagered: string;      // ETH formatted
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  winRate: number;           // 0-100
  totalPayout: string;       // ETH formatted
  netProfit: string;         // ETH formatted (can be negative)
  avgMultiplier: number;
  maxMultiplier: number;
  highestPayout: string;     // ETH formatted
  longestStreak: number;     // Consecutive wins
  onChain?: {
    totalWagered: string;
    totalNetWinnings: string;
    settledWagerCount: number;
  } | null;
}

// Verification types
export interface VerificationRequest {
  sessionId: string;
  userAddress: string;
  verifiedHash?: string;
}

export interface VerificationResponse {
  success: boolean;
  error?: string;
}
