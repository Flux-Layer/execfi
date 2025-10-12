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
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonceBase: number;
  rowsMeta: RowFairnessMeta[];
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

export type StoredSession = {
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
};

export const ROW_STATUS_LABELS: Record<RowStatusView, string> = {
  completed: "Completed",
  active: "In Play",
  crash: "Crash",
  locked: "Upcoming",
};
