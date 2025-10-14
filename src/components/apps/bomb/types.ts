import type { RowFairnessMeta } from "@/lib/games/bomb/fairness";

export type GameStatus = "idle" | "lost" | "won";

export type RowStatusView = "completed" | "active" | "crash" | "locked";

export type RowLayout = {
  rowMultiplier: number;
  activeColumns: number[];
  visibleColumns: number[];
  selectedColumn: number | null;
  isCompleted: boolean;
  crashed: boolean;
  fairness: RowFairnessMeta;
};

export type FairnessState = {
  serverSeed: string | null;
  serverSeedHash: string;
  clientSeed: string | null;
  nonceBase: number;
  rowsMeta: RowFairnessMeta[];
  revealed: boolean;
};

export type RowMultiplierStat = {
  index: number;
  rowNumber: number;
  tiles: number;
  bombs: number;
  rowMultiplier: number;
  carryIn: number;
  cumulative: number;
  status: RowStatusView;
};

export type RoundSummary = {
  xp: number;
  kills: number;
  timeAlive: number;
  score: number;
  multiplier: number;
  completedRows: number;
};

export type StoredSession = {
  sessionId?: string | null;
  finalizedSessionId?: string | null;
  hasStarted: boolean;
  betAmount: number;
  status: GameStatus;
  activeRowIndex: number;
  lostRow: number | null;
  fairness: FairnessState;
  rowsState: Array<{
    selectedColumn: number | null;
    crashed: boolean;
    isCompleted: boolean;
  }>;
  currentMultiplier: number;
  roundSummary?: RoundSummary | null;
};

export const ROW_STATUS_LABELS: Record<RowStatusView, string> = {
  completed: "Completed",
  active: "In Play",
  crash: "Crash",
  locked: "Upcoming",
};
