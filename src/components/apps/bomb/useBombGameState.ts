"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BOMBS_PER_ROW,
  HOUSE_EDGE,
  MAX_TILE_OPTION,
  MAX_TOTAL_MULTIPLIER,
  MIN_BET_AMOUNT,
  MIN_TILE_OPTION,
} from "./config";
import type {
  FairnessState,
  GameStatus,
  RowLayout,
  RowMultiplierStat,
  StoredSession,
} from "./types";
import {
  centerColumns,
  clampTileValue,
  computeDynamicRowCount,
  loadStoredSession,
  saveStoredSession,
  DEFAULT_TILE_RANGE,
} from "./utils";
import {
  buildFairRows,
  calculateRowMultiplier,
  generateSeeds,
  randomHex,
  verifyRow,
  type VerifyRowResult,
} from "@/lib/games/bomb/fairness";

export type VerificationRowOutput = VerifyRowResult & { rowIndex: number };

export type SummaryVariant = "idle" | "active" | "won" | "lost";

export type UseBombGameStateOptions = {
  fullscreen: boolean;
  isMobile: boolean;
};

export type UseBombGameStateReturn = {
  // layout refs
  windowRef: React.MutableRefObject<HTMLDivElement | null>;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  rowRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
  effectiveFullscreen: boolean;
  position: { x: number; y: number };
  isReady: boolean;
  dragging: boolean;
  handleHeaderDrag: (event: React.PointerEvent<HTMLDivElement>) => void;

  // core status
  rows: RowLayout[];
  rowsForRender: Array<{ row: RowLayout; originalIndex: number }>;
  rowStats: RowMultiplierStat[];
  activeRowIndex: number;
  hasStarted: boolean;
  status: GameStatus;
  lostRow: number | null;
  showGameOver: boolean;
  setShowGameOver: React.Dispatch<React.SetStateAction<boolean>>;

  // summary data
  summaryTitle: string;
  summaryVariant: SummaryVariant;
  carryInForPanel: number;
  potentialPayout: number | null;
  betAmount: number | null;

  // betting controls
  betInput: string;
  betError: string | null;
  updateBetInput: (value: string) => void;
  quickBet: (value: number) => void;
  handleStartGame: () => void;
  isStartDisabled: boolean;
  startLabel: string;

  // sound & modal toggles
  soundOn: boolean;
  toggleSound: () => void;
  showInfo: boolean;
  openInfo: () => void;
  closeInfo: () => void;

  // customizer
  showCustomizer: boolean;
  openCustomizer: () => void;
  closeCustomizer: () => void;
  tileRange: { min: number; max: number };
  pendingRange: { min: number; max: number };
  adjustPendingRange: (key: "min" | "max", delta: number) => void;
  projectedMaxMultiplier: number;
  applyTileRange: () => Promise<void>;
  useDefaultTileRange: () => Promise<void>;

  // fairness + seeds
  fairnessState: FairnessState | null;
  clientSeedInput: string;
  setClientSeedInput: React.Dispatch<React.SetStateAction<string>>;
  randomizeClientSeed: () => void;
  applyClientSeed: () => Promise<void>;
  txHashInput: string;
  setTxHashInput: React.Dispatch<React.SetStateAction<string>>;
  txHashVerified: boolean;
  isVerifying: boolean;
  verificationStatus: "idle" | "valid" | "invalid" | "error";
  verificationOutput: VerificationRowOutput[] | null;
  revealFairness: () => Promise<void>;
  verifyRound: () => Promise<void>;

  // async helpers
  isBuildingRound: boolean;
  rerollTiles: () => Promise<void>;
  handleTileClick: (rowIndex: number, column: number) => void;
  playAgain: () => Promise<void>;
  dismissGameOver: () => void;
};

export function useBombGameState({
  fullscreen,
  isMobile,
}: UseBombGameStateOptions): UseBombGameStateReturn {
  const windowRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const pendingSessionRef = useRef<StoredSession | null>(null);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [tileRange, setTileRange] = useState<{ min: number; max: number }>(() => ({
    ...DEFAULT_TILE_RANGE,
  }));
  const [rows, setRows] = useState<RowLayout[]>([]);
  const [activeRowIndex, setActiveRowIndex] = useState<number>(-1);
  const [showInfo, setShowInfo] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [pendingRange, setPendingRange] = useState<{ min: number; max: number }>(() => ({
    ...DEFAULT_TILE_RANGE,
  }));
  const [hasStarted, setHasStarted] = useState(false);
  const [betInput, setBetInput] = useState("0.001");
  const [betError, setBetError] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<number | null>(null);
  const [pendingSession, setPendingSession] = useState<StoredSession | null>(null);
  const [status, setStatus] = useState<GameStatus>("idle");
  const [lostRow, setLostRow] = useState<number | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const [fairnessState, setFairnessState] = useState<FairnessState | null>(null);
  const [clientSeedInput, setClientSeedInput] = useState("");
  const [isBuildingRound, setIsBuildingRound] = useState(false);
  const [verificationStatus, setVerificationStatus] =
    useState<"idle" | "valid" | "invalid" | "error">("idle");
  const [verificationOutput, setVerificationOutput] =
    useState<VerificationRowOutput[] | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [txHashInput, setTxHashInput] = useState("");
  const [txHashVerified, setTxHashVerified] = useState(false);

  const effectiveFullscreen = fullscreen || isMobile;

  useEffect(() => {
    pendingSessionRef.current = pendingSession;
  }, [pendingSession]);

  const adjustPendingRange = useCallback((key: "min" | "max", delta: number) => {
    setPendingRange((prev) => {
      const nextValue = clampTileValue(prev[key] + delta);
      let min = prev.min;
      let max = prev.max;
      if (key === "min") {
        min = nextValue;
        if (nextValue > max) {
          max = nextValue;
        }
      } else {
        max = nextValue;
        if (nextValue < min) {
          min = nextValue;
        }
      }
      return { min, max };
    });
  }, []);

  const projectedMaxMultiplier = useMemo(() => {
    const capped = calculateRowMultiplier(pendingRange.min, BOMBS_PER_ROW, HOUSE_EDGE);
    return Math.min(capped, MAX_TOTAL_MULTIPLIER);
  }, [pendingRange.min]);

  const rowsForRender = useMemo(
    () =>
      rows
        .map((row, idx) => ({
          row,
          originalIndex: idx,
        }))
        .reverse(),
    [rows],
  );

  const baselineMultipliers = useMemo(() => {
    if (rows.length === 0) return [];
    let carry = 1;
    return rows.map((row, idx) => {
      const bombs = row.fairness.bombsPerRow ?? BOMBS_PER_ROW;
      const tiles = row.fairness.tileCount;
      const rowMultiplier = calculateRowMultiplier(tiles, bombs, HOUSE_EDGE);
      const carryIn = carry;
      const cumulative = carryIn * rowMultiplier;
      carry = cumulative;
      return {
        index: idx,
        rowNumber: idx + 1,
        tiles,
        bombs,
        rowMultiplier,
        carryIn,
        cumulative,
      };
    });
  }, [rows]);

  const rowStats = useMemo<RowMultiplierStat[]>(() => {
    if (rows.length === 0) return [];

    return rows.map((row, idx) => {
      const baseline = baselineMultipliers[idx];
      if (!baseline) {
        return {
          index: idx,
          rowNumber: idx + 1,
          tiles: row.fairness.tileCount,
          bombs: row.fairness.bombsPerRow ?? BOMBS_PER_ROW,
          rowMultiplier: 0,
          carryIn: 0,
          cumulative: 0,
          status: "locked",
        };
      }

      let rowStatus: RowMultiplierStat["status"] = "locked";
      if (!hasStarted) {
        rowStatus = "locked";
      } else if (status === "lost") {
        if (lostRow !== null) {
          if (idx < lostRow) {
            rowStatus = "completed";
          } else if (idx === lostRow) {
            rowStatus = "crash";
          } else {
            rowStatus = "locked";
          }
        } else if (idx === activeRowIndex) {
          rowStatus = "crash";
        } else if (idx < activeRowIndex) {
          rowStatus = "completed";
        } else {
          rowStatus = "locked";
        }
      } else if (status === "won") {
        rowStatus = "completed";
      } else if (row.crashed) {
        rowStatus = "crash";
      } else if (row.isCompleted) {
        rowStatus = "completed";
      } else if (idx === activeRowIndex) {
        rowStatus = "active";
      } else if (idx < activeRowIndex) {
        rowStatus = "completed";
      } else {
        rowStatus = "locked";
      }

      let cumulative = baseline.cumulative;
      if (rowStatus === "crash") {
        cumulative = 0;
      }

      return {
        index: idx,
        rowNumber: baseline.rowNumber,
        tiles: baseline.tiles,
        bombs: baseline.bombs,
        rowMultiplier: baseline.rowMultiplier,
        carryIn: baseline.carryIn,
        cumulative,
        status: rowStatus,
      };
    });
  }, [rows, baselineMultipliers, status, lostRow, activeRowIndex, hasStarted]);

  const activeRowStat = useMemo(
    () => rowStats.find((stat) => stat.status === "active") ?? null,
    [rowStats],
  );

  const crashRowStat = useMemo(
    () => rowStats.find((stat) => stat.status === "crash") ?? null,
    [rowStats],
  );

  const lastCompletedStat = useMemo(() => {
    for (let idx = rowStats.length - 1; idx >= 0; idx -= 1) {
      if (rowStats[idx]?.status === "completed") {
        return rowStats[idx];
      }
    }
    return null;
  }, [rowStats]);

  const carryInForPanel = useMemo(() => {
    if (crashRowStat) return crashRowStat.carryIn ?? 0;
    if (activeRowStat) return activeRowStat.carryIn ?? 1;
    if (lastCompletedStat) return lastCompletedStat.cumulative;
    return baselineMultipliers[0]?.carryIn ?? 1;
  }, [crashRowStat, activeRowStat, lastCompletedStat, baselineMultipliers]);

  const potentialPayout = useMemo(() => {
    if (!hasStarted || !betAmount) return null;
    return betAmount * carryInForPanel;
  }, [betAmount, carryInForPanel, hasStarted]);

  const summaryTitle = useMemo(() => {
    if (!hasStarted) return "Set bet to start";
    if (status === "lost") return `Row ${crashRowStat?.rowNumber ?? "?"} crashed`;
    if (activeRowStat) return `Row ${activeRowStat.rowNumber} in play`;
    if (status === "won") return "Round cleared";
    return "Choose a tile";
  }, [hasStarted, status, crashRowStat, activeRowStat]);

  const summaryVariant: SummaryVariant = useMemo(() => {
    if (!hasStarted) return "idle";
    if (status === "lost") return "lost";
    if (status === "won") return "won";
    if (activeRowStat) return "active";
    return "idle";
  }, [hasStarted, status, activeRowStat]);

  const isRoundInProgress = useMemo(() => {
    if (!hasStarted) return false;
    return status !== "won" && status !== "lost";
  }, [hasStarted, status]);

  const initPosition = useCallback(() => {
    if (typeof window === "undefined" || effectiveFullscreen) return;
    const node = windowRef.current;
    if (!node) return;
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    setPosition({
      x: Math.max((window.innerWidth - w) / 2, 0),
      y: Math.max((window.innerHeight - h) / 2, 0),
    });
    setIsReady(true);
  }, [effectiveFullscreen]);

  useEffect(() => {
    const frame = requestAnimationFrame(initPosition);
    return () => cancelAnimationFrame(frame);
  }, [initPosition]);

  useEffect(() => {
    if (activeRowIndex < 0) return;
    const node = rowRefs.current[activeRowIndex];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeRowIndex]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      if (effectiveFullscreen) return;
      const node = windowRef.current;
      if (!node) return;
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      const maxX = Math.max(window.innerWidth - w, 0);
      const maxY = Math.max(window.innerHeight - h, 0);
      setPosition((prev) => ({
        x: Math.min(Math.max(prev.x, 0), maxX),
        y: Math.min(Math.max(prev.y, 0), maxY),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [effectiveFullscreen]);

  useEffect(() => {
    if (!effectiveFullscreen) setIsReady(false);
  }, [effectiveFullscreen]);

  useEffect(() => {
    if (effectiveFullscreen && containerRef.current) {
      const scrollToBottom = () => {
        const scrollable = containerRef.current?.querySelector('[class*="overflow"]');
        if (scrollable instanceof HTMLElement) {
          scrollable.scrollTop = scrollable.scrollHeight;
        }
      };

      requestAnimationFrame(() => {
        scrollToBottom();
        setTimeout(scrollToBottom, 50);
        setTimeout(scrollToBottom, 150);
      });
    }
  }, [effectiveFullscreen, rows]);

  const handleHeaderDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (effectiveFullscreen) return;
      const parent = event.currentTarget.parentElement as HTMLElement | null;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      setDragging(true);

      const handleMove = (ev: PointerEvent) => {
        setPosition({
          x: Math.max(0, ev.clientX - offsetX),
          y: Math.max(0, ev.clientY - offsetY),
        });
      };

      const handleUp = () => {
        setDragging(false);
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove, { passive: true });
      window.addEventListener("pointerup", handleUp, { passive: true });
    },
    [effectiveFullscreen],
  );

  const buildRowsWithSeeds = useCallback(
    async (
      seedPayload: {
        serverSeed: string;
        serverSeedHash: string;
        clientSeed: string;
        nonceBase?: number;
      },
      range?: { min: number; max: number },
    ) => {
      setIsBuildingRound(true);
      try {
        const minTiles = range?.min ?? MIN_TILE_OPTION;
        const maxTiles = range?.max ?? MAX_TILE_OPTION;
        const normalizedRange = {
          min: Math.min(Math.max(minTiles, MIN_TILE_OPTION), MAX_TILE_OPTION),
          max: Math.min(Math.max(maxTiles, MIN_TILE_OPTION), MAX_TILE_OPTION),
        };
        if (normalizedRange.max < normalizedRange.min) {
          normalizedRange.max = normalizedRange.min;
        }
        const explicitTileCount =
          normalizedRange.min === normalizedRange.max ? normalizedRange.min : null;

        const dynamicRowCount = computeDynamicRowCount(normalizedRange);

        const { rows: fairRows } = await buildFairRows({
          serverSeed: seedPayload.serverSeed,
          clientSeed: seedPayload.clientSeed,
          rowCount: dynamicRowCount,
          nonceBase: seedPayload.nonceBase ?? 0,
          tilePreference: explicitTileCount,
          minTiles: normalizedRange.min,
          maxTiles: normalizedRange.max,
          bombsPerRow: BOMBS_PER_ROW,
          houseEdge: HOUSE_EDGE,
          maxTotalMultiplier: MAX_TOTAL_MULTIPLIER,
        });

        const limitedRows: typeof fairRows = [];
        let cumulativePreview = 1;
        for (const meta of fairRows) {
          const nextPreview = cumulativePreview * meta.rowMultiplier;
          if (nextPreview >= MAX_TOTAL_MULTIPLIER && limitedRows.length > 0) {
            break;
          }
          limitedRows.push(meta);
          cumulativePreview = nextPreview;
          if (cumulativePreview >= MAX_TOTAL_MULTIPLIER) {
            break;
          }
        }

        const effectiveRows = limitedRows.length ? limitedRows : fairRows.slice(0, 1);

        const layouts: RowLayout[] = effectiveRows.map((meta) => {
          const visibleColumns = centerColumns(meta.tileCount);
          return {
            rowMultiplier: meta.rowMultiplier,
            activeColumns: visibleColumns,
            visibleColumns,
            selectedColumn: null,
            isCompleted: false,
            crashed: false,
            fairness: meta,
          };
        });

        const sessionMatch = pendingSessionRef.current;
        const matchesStoredSession =
          sessionMatch &&
          sessionMatch.fairness.serverSeed === seedPayload.serverSeed &&
          sessionMatch.fairness.clientSeed === seedPayload.clientSeed;

        let nextLayouts = layouts;
        if (matchesStoredSession && sessionMatch) {
          nextLayouts = layouts.map((layout, idx) => {
            const stored = sessionMatch.rowsState[idx];
            if (!stored) return layout;
            return {
              ...layout,
              selectedColumn: stored.selectedColumn,
              crashed: stored.crashed,
              isCompleted: stored.isCompleted,
            };
          });
        }

        setRows(nextLayouts);
        rowRefs.current = [];
        setFairnessState({
          serverSeed: seedPayload.serverSeed,
          serverSeedHash: seedPayload.serverSeedHash,
          clientSeed: seedPayload.clientSeed,
          nonceBase: seedPayload.nonceBase ?? 0,
          rowsMeta: effectiveRows,
        });

        if (matchesStoredSession && sessionMatch) {
          setActiveRowIndex(sessionMatch.activeRowIndex);
          setStatus(sessionMatch.status);
          setLostRow(sessionMatch.lostRow);
          setShowGameOver(sessionMatch.status === "lost");
          setHasStarted(sessionMatch.hasStarted);
          setBetAmount(sessionMatch.betAmount);
          setBetInput(sessionMatch.betAmount.toString());
          pendingSessionRef.current = null;
          setPendingSession(null);
        } else {
          setActiveRowIndex(0);
          setStatus("idle");
          setLostRow(null);
          setShowGameOver(false);
          setHasStarted(false);
          setBetAmount(null);
          pendingSessionRef.current = null;
          setPendingSession(null);
        }
        setVerificationStatus("idle");
        setVerificationOutput(null);
        setClientSeedInput(seedPayload.clientSeed);
        setPendingRange(normalizedRange);
        setTileRange(normalizedRange);
        setTxHashInput("");
        setTxHashVerified(false);
      } catch (error) {
        console.error("[Bomb Game] Failed to build round:", error);
      } finally {
        setIsBuildingRound(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!fairnessState || !hasStarted) {
      saveStoredSession(null);
      return;
    }
    const rawBet = betAmount ?? Number(betInput);
    const normalizedBet =
      typeof rawBet === "number" && Number.isFinite(rawBet) && rawBet >= MIN_BET_AMOUNT
        ? rawBet
        : MIN_BET_AMOUNT;

    const session: StoredSession = {
      hasStarted,
      betAmount: normalizedBet,
      status,
      activeRowIndex,
      lostRow,
      fairness: fairnessState,
      rowsState: rows.map((row) => ({
        selectedColumn: row.selectedColumn,
        crashed: row.crashed,
        isCompleted: row.isCompleted,
      })),
    };
    saveStoredSession(session);
  }, [hasStarted, status, activeRowIndex, lostRow, rows, fairnessState, betAmount, betInput]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = loadStoredSession();
        if (stored && stored.fairness) {
          if (cancelled) return;
          setPendingSession(stored);
          pendingSessionRef.current = stored;
          setBetInput(stored.betAmount.toString());
          setBetAmount(stored.betAmount);
          await buildRowsWithSeeds(
            {
              serverSeed: stored.fairness.serverSeed,
              serverSeedHash: stored.fairness.serverSeedHash,
              clientSeed: stored.fairness.clientSeed,
              nonceBase: stored.fairness.nonceBase,
            },
            tileRange,
          );
          return;
        }

        const seeds = await generateSeeds();
        if (cancelled) return;
        await buildRowsWithSeeds(
          {
            serverSeed: seeds.serverSeed,
            serverSeedHash: seeds.serverSeedHash,
            clientSeed: seeds.clientSeed,
            nonceBase: 0,
          },
          undefined,
        );
      } catch (error) {
        console.error("[Bomb Game] Unable to initialise round:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildRowsWithSeeds]);

  const rerollTiles = useCallback(async () => {
    try {
      const seeds = await generateSeeds(fairnessState?.clientSeed);
      await buildRowsWithSeeds(
        {
          serverSeed: seeds.serverSeed,
          serverSeedHash: seeds.serverSeedHash,
          clientSeed: seeds.clientSeed,
          nonceBase: 0,
        },
        tileRange,
      );
    } catch (error) {
      console.error("[Bomb Game] Failed to reroll tiles:", error);
    }
  }, [buildRowsWithSeeds, tileRange, fairnessState]);

  const playAgain = useCallback(async () => {
    setStatus("idle");
    setShowGameOver(false);
    setLostRow(null);
    await rerollTiles();
  }, [rerollTiles]);

  const dismissGameOver = useCallback(() => {
    setShowGameOver(false);
  }, []);

  const applyTileRange = useCallback(async () => {
    if (!fairnessState) return;
    const appliedValue = {
      min: pendingRange.min,
      max: pendingRange.max,
    };
    try {
      setTileRange(appliedValue);
      await buildRowsWithSeeds(
        {
          serverSeed: fairnessState.serverSeed,
          serverSeedHash: fairnessState.serverSeedHash,
          clientSeed: fairnessState.clientSeed,
          nonceBase: fairnessState.nonceBase,
        },
        appliedValue,
      );
    } finally {
      setShowCustomizer(false);
    }
  }, [buildRowsWithSeeds, fairnessState, pendingRange]);

  const useDefaultTileRange = useCallback(async () => {
    if (!fairnessState) return;
    try {
      const resetRange = { ...DEFAULT_TILE_RANGE };
      setTileRange(resetRange);
      setPendingRange(resetRange);
      await buildRowsWithSeeds(
        {
          serverSeed: fairnessState.serverSeed,
          serverSeedHash: fairnessState.serverSeedHash,
          clientSeed: fairnessState.clientSeed,
          nonceBase: fairnessState.nonceBase,
        },
        resetRange,
      );
    } finally {
      setShowCustomizer(false);
    }
  }, [buildRowsWithSeeds, fairnessState]);

  const applyClientSeed = useCallback(async () => {
    if (!fairnessState) return;
    const nextSeed = clientSeedInput.trim();
    if (!nextSeed) return;
    await buildRowsWithSeeds(
      {
        serverSeed: fairnessState.serverSeed,
        serverSeedHash: fairnessState.serverSeedHash,
        clientSeed: nextSeed,
        nonceBase: fairnessState.nonceBase,
      },
      tileRange,
    );
  }, [buildRowsWithSeeds, clientSeedInput, fairnessState, tileRange]);

  const randomizeClientSeed = useCallback(() => {
    const newSeed = randomHex(16);
    setClientSeedInput(newSeed);
  }, []);

  const verifyRound = useCallback(async () => {
    if (!fairnessState) return;
    setIsVerifying(true);
    try {
      const results: VerificationRowOutput[] = [];
      for (const row of fairnessState.rowsMeta) {
        const verification = await verifyRow({
          serverSeed: fairnessState.serverSeed,
          serverSeedHash: fairnessState.serverSeedHash,
          clientSeed: fairnessState.clientSeed,
          nonce: row.nonce,
          tileCount: row.tileCount,
          expectedBombIndex: row.bombIndex,
          bombsPerRow: 1,
        });
        results.push({ rowIndex: row.rowIndex, ...verification });
      }

      const allValid = results.every((res) => res.valid);
      setVerificationStatus(allValid ? "valid" : "invalid");
      setVerificationOutput(results);
    } catch (error) {
      console.error("[Bomb Game] Verification failed:", error);
      setVerificationStatus("error");
      setVerificationOutput(null);
    } finally {
      setIsVerifying(false);
    }
  }, [fairnessState]);

  const revealFairness = useCallback(async () => {
    if (!fairnessState) return;
    if (!txHashInput.trim()) {
      setVerificationStatus("error");
      setVerificationOutput(null);
      return;
    }
    setTxHashVerified(true);
    await verifyRound();
  }, [fairnessState, verifyRound, txHashInput]);

  const handleStartGame = useCallback(() => {
    const parsed = Number(betInput);
    if (!Number.isFinite(parsed) || parsed < MIN_BET_AMOUNT) {
      setBetError(`Minimum bet is ${MIN_BET_AMOUNT} ETH`);
      return;
    }
    setBetError(null);
    setBetAmount(parsed);
    setHasStarted(true);
    if (status === "lost" || status === "won") {
      setStatus("idle");
      setLostRow(null);
      setShowGameOver(false);
    }
  }, [betInput, status]);

  const handleTileClick = useCallback(
    (rowIndex: number, column: number) => {
      if (!hasStarted) return;
      if (status === "lost") return;
      if (rowIndex !== activeRowIndex) return;
      const currentRow = rows[rowIndex];
      if (!currentRow) return;
      if (currentRow.selectedColumn !== null) return;
      if (!currentRow.activeColumns.includes(column)) return;

      const selectedRow = rows[rowIndex];
      const bombColumn = selectedRow.activeColumns[selectedRow.fairness.bombIndex] ?? null;
      const hitBomb = bombColumn !== null && column === bombColumn;

      setRows((prev) =>
        prev.map((row, idx) => {
          if (idx !== rowIndex) return row;
          if (row.selectedColumn !== null) return row;
          if (hitBomb) {
            return {
              ...row,
              selectedColumn: column,
              crashed: true,
              isCompleted: false,
            };
          }
          return {
            ...row,
            selectedColumn: column,
            crashed: false,
            isCompleted: true,
          };
        }),
      );

      if (hitBomb) {
        setStatus("lost");
        setLostRow(rowIndex);
        setShowGameOver(true);
        return;
      }

      const nextIndex = activeRowIndex + 1 < rows.length ? activeRowIndex + 1 : -1;
      setActiveRowIndex(nextIndex);
      if (nextIndex === -1) {
        setStatus("won");
      }
    },
    [hasStarted, status, activeRowIndex, rows],
  );

  const updateBetInput = useCallback((value: string) => {
    setBetInput(value.replace(/,/g, "."));
    setBetError(null);
  }, []);

  const quickBet = useCallback((value: number) => {
    setBetInput(value.toString());
    setBetError(null);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((prev) => !prev);
  }, []);

  const openCustomizer = useCallback(() => {
    setPendingRange(tileRange);
    setShowCustomizer(true);
  }, [tileRange]);

  const closeCustomizer = useCallback(() => {
    setShowCustomizer(false);
  }, []);

  const openInfo = useCallback(() => setShowInfo(true), []);
  const closeInfo = useCallback(() => setShowInfo(false), []);

  const isStartDisabled = isRoundInProgress || isBuildingRound;

  const startLabel = isRoundInProgress ? "In Progress" : "Start Round";

  return {
    windowRef,
    containerRef,
    rowRefs,
    effectiveFullscreen,
    position,
    isReady,
    dragging,
    handleHeaderDrag,
    rows,
    rowsForRender,
    rowStats,
    activeRowIndex,
    hasStarted,
    status,
    lostRow,
    showGameOver,
    setShowGameOver,
    summaryTitle,
    summaryVariant,
    carryInForPanel,
    potentialPayout,
    betAmount,
    betInput,
    betError,
    updateBetInput,
    quickBet,
    handleStartGame,
    isStartDisabled,
    startLabel,
    soundOn,
    toggleSound,
    showInfo,
    openInfo,
    closeInfo,
    showCustomizer,
    openCustomizer,
    closeCustomizer,
    tileRange,
    pendingRange,
    adjustPendingRange,
    projectedMaxMultiplier,
    applyTileRange,
    useDefaultTileRange,
    fairnessState,
    clientSeedInput,
    setClientSeedInput,
    randomizeClientSeed,
    applyClientSeed,
    txHashInput,
    setTxHashInput,
    txHashVerified,
    isVerifying,
    verificationStatus,
    verificationOutput,
    revealFairness,
    verifyRound,
    isBuildingRound,
    rerollTiles,
    handleTileClick,
    playAgain,
    dismissGameOver,
  };
}
