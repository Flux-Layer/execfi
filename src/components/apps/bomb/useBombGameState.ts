"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConnectedWallet } from "@privy-io/react-auth";
import {
  BaseError,
  ContractFunctionRevertedError,
  createWalletClient,
  custom,
  decodeErrorResult,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { base, baseSepolia } from "viem/chains";
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
  RoundSummary,
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
  randomHex,
  verifyRow,
  type RowFairnessMeta,
  type VerifyRowResult,
} from "@/lib/games/bomb/fairness";
import {
  DEGENSHOOT_ADDRESS,
  DEGENSHOOT_CHAIN_ID,
  ONCHAIN_FEATURES_ENABLED,
  WAGER_VAULT_ADDRESS,
} from "@/lib/contracts/addresses";
import {
  DEGENSHOOT_ABI,
  DEGENSHOOT_CHAIN,
  DEGENSHOOT_GAME_ID_BIGINT,
  degenshootPublicClient,
} from "@/lib/contracts/degenshoot";
import {
  WAGER_VAULT_ABI,
  WAGER_VAULT_CHAIN,
  wagerVaultPublicClient,
} from "@/lib/contracts/wagerVault";
import { XP_REGISTRY_ABI } from "@/lib/contracts/xpRegistry";

export type VerificationRowOutput = VerifyRowResult & { rowIndex: number };

export type SummaryVariant = "idle" | "active" | "won" | "lost";

export type UseBombGameStateOptions = {
  fullscreen: boolean;
  isMobile: boolean;
  wallet?: ConnectedWallet | null;
  activeAddress?: `0x${string}` | undefined;
  balanceNumeric?: number | null;
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
  potentialPayout: number | null;
  currentMultiplier: number;
  betAmount: number | null;

  // betting controls
  betInput: string;
  betError: string | null;
  updateBetInput: (value: string) => void;
  quickBet: (value: number) => void;
  handleStartGame: () => void;
  handleCashOut: () => void;
  isStartDisabled: boolean;
  startLabel: string;
  canCashOut: boolean;
  cashOutAmount: number | null;
  betAmountValue: number | null;

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
  isVerifying: boolean;
  isRevealing: boolean;
  verificationStatus: "idle" | "valid" | "invalid" | "error";
  verificationOutput: VerificationRowOutput[] | null;
  revealFairness: () => Promise<void>;
  verifyRound: () => Promise<void>;

  // async helpers
  isBuildingRound: boolean;
  rerollTiles: () => Promise<void>;
  handleTileClick: (rowIndex: number, column: number) => void;
  playAgain: () => void;
  dismissGameOver: () => void;
  sessionId: string | null;
  betTxHash: string | null;
  resultTxHash: string | null;
  withdrawTxHash: string | null;
  isOnchainBusy: boolean;
  isWithdrawing: boolean;
  roundSummary: RoundSummary | null;
  canReveal: boolean;
  finalizedSessionId: string | null;
  isRoundInProgress: boolean;
  startHelperText: string | null;
  needsChainSwitch: boolean;
  switchToGameChain: () => Promise<void>;
  targetChainLabel: string;
  isWalletConnected: boolean;
  isSessionStuck: boolean;
  restartStuckSession: () => Promise<void>;
};

export function useBombGameState({
  fullscreen,
  isMobile,
  wallet,
  activeAddress,
  balanceNumeric,
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
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
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
  const currentClientSeed = fairnessState?.clientSeed;
  const [clientSeedInput, setClientSeedInput] = useState("");
  const [isBuildingRound, setIsBuildingRound] = useState(false);
  const [verificationStatus, setVerificationStatus] =
    useState<"idle" | "valid" | "invalid" | "error">("idle");
  const [verificationOutput, setVerificationOutput] =
    useState<VerificationRowOutput[] | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isOnchainBusy, setIsOnchainBusy] = useState(false);
  const [betTxHash, setBetTxHash] = useState<string | null>(null);
  const [resultTxHash, setResultTxHash] = useState<string | null>(null);
  const [withdrawTxHash, setWithdrawTxHash] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [finalizedSessionId, setFinalizedSessionId] = useState<string | null>(null);
  const [roundSummary, setRoundSummary] = useState<
    | {
        xp: number;
        kills: number;
        timeAlive: number;
        score: number;
        multiplier: number;
        completedRows: number;
      }
    | null
  >(null);
  const [isSessionStuck, setIsSessionStuck] = useState(false);
  const resultSubmittedRef = useRef(false);
  const gameCompletionRef = useRef<{ status: GameStatus; sessionId: string | null }>({
    status: "idle",
    sessionId: null,
  });

  const effectiveFullscreen = fullscreen || isMobile;
  const normalizedActiveAddress = activeAddress?.toLowerCase() ?? null;

  const tileRangeRef = useRef(tileRange);
  const lockedTileCountsRef = useRef<number[] | null>(null);
  useEffect(() => {
    tileRangeRef.current = tileRange;
  }, [tileRange]);

  // Track game completion to preserve status after cash out
  useEffect(() => {
    gameCompletionRef.current = {
      status,
      sessionId: finalizedSessionId,
    };
  }, [status, finalizedSessionId]);

  const hasInitialisedRef = useRef(false);

  const walletChainId = useMemo(() => {
    if (!wallet?.chainId) return null;
    const parts = wallet.chainId.split(":");
    const maybe = parts[parts.length - 1];
    const parsed = Number(maybe);
    return Number.isFinite(parsed) ? parsed : null;
  }, [wallet]);

  const desiredChainHex = useMemo(
    () => `0x${DEGENSHOOT_CHAIN_ID.toString(16)}` as `0x${string}`,
    [],
  );

  const targetChainLabel = useMemo(() => {
    if (DEGENSHOOT_CHAIN_ID === base.id) return "Base";
    if (DEGENSHOOT_CHAIN_ID === baseSepolia.id) return "Base Sepolia";
    return `Chain ${DEGENSHOOT_CHAIN_ID}`;
  }, []);

  const isWalletConnected = Boolean(wallet && activeAddress);
  const needsChainSwitch =
    isWalletConnected && walletChainId !== null && walletChainId !== DEGENSHOOT_CHAIN_ID;

  const switchToGameChain = useCallback(async () => {
    if (!wallet) return;
    try {
      await wallet.switchChain(desiredChainHex);
      setBetError(null);
    } catch (error) {
      console.error("[Bomb Game] Failed to switch chain:", error);
      setBetError((error as Error).message ?? "Failed to switch network");
    }
  }, [wallet, desiredChainHex]);

  const onchainReady =
    ONCHAIN_FEATURES_ENABLED &&
    Boolean(wallet && activeAddress && DEGENSHOOT_ADDRESS && WAGER_VAULT_ADDRESS);

  useEffect(() => {
    pendingSessionRef.current = pendingSession;
  }, [pendingSession]);

  useEffect(() => {
    if (betTxHash) {
      console.log("[BombGame] Bet transaction submitted:", betTxHash);
    }
  }, [betTxHash]);

  useEffect(() => {
    if (resultTxHash) {
      console.log("[BombGame] Result transaction submitted:", resultTxHash)
    }
  }, [resultTxHash]);

  useEffect(() => {
    if (withdrawTxHash) {
      console.log("[BombGame] Withdraw transaction submitted:", withdrawTxHash);
    }
  }, [withdrawTxHash]);

  const buildRowsWithSeeds = useCallback(
    async (
      seedPayload: {
        serverSeed: string | null;
        serverSeedHash: string;
        clientSeed: string | null;
        nonceBase?: number;
      },
      range?: { min: number; max: number },
      lockedTileCounts?: number[] | null,
      precomputedRows?: RowFairnessMeta[] | null,
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

        const dynamicRowCount = precomputedRows && precomputedRows.length
          ? precomputedRows.length
          : computeDynamicRowCount(normalizedRange);

        const fairRowsSource: RowFairnessMeta[] = precomputedRows
          ? precomputedRows.map((meta, index) => ({
              rowIndex: meta.rowIndex ?? index,
              nonce: meta.nonce ?? index,
              gameHash: meta.gameHash ?? "",
              tileCount: meta.tileCount,
              bombIndex: typeof meta.bombIndex === "number" ? meta.bombIndex : -1,
              rowMultiplier: meta.rowMultiplier ?? 1,
              bombsPerRow: meta.bombsPerRow ?? BOMBS_PER_ROW,
              probabilities: meta.probabilities ?? [],
            }))
          : (
              await buildFairRows({
                serverSeed: seedPayload.serverSeed ?? randomHex(32),
                clientSeed: seedPayload.clientSeed ?? randomHex(16),
                rowCount: dynamicRowCount,
                nonceBase: seedPayload.nonceBase ?? 0,
                tilePreference: explicitTileCount,
                minTiles: normalizedRange.min,
                maxTiles: normalizedRange.max,
                bombsPerRow: BOMBS_PER_ROW,
                houseEdge: HOUSE_EDGE,
                maxTotalMultiplier: MAX_TOTAL_MULTIPLIER,
                explicitTileCounts: lockedTileCounts ?? undefined,
              })
            ).rows;

        const limitedRows: typeof fairRowsSource = [];
        let cumulativePreview = 1;
        for (const meta of fairRowsSource) {
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

        const effectiveRows = limitedRows.length ? limitedRows : fairRowsSource.slice(0, 1);

        const layouts: RowLayout[] = effectiveRows.map((meta) => {
          const visibleColumns = centerColumns(meta.tileCount);
          return {
            rowMultiplier: meta.rowMultiplier,
            activeColumns: visibleColumns,
            visibleColumns,
            selectedColumn: null,
            crashed: false,
            isCompleted: false,
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
          serverSeed: seedPayload.serverSeed ?? null,
          serverSeedHash: seedPayload.serverSeedHash,
          clientSeed: seedPayload.clientSeed ?? null,
          nonceBase: seedPayload.nonceBase ?? 0,
          rowsMeta: effectiveRows,
          revealed: Boolean(seedPayload.serverSeed && seedPayload.serverSeed.length > 0),
        });

        if (lockedTileCounts && lockedTileCounts.length) {
          lockedTileCountsRef.current = [...lockedTileCounts];
        } else if (!lockedTileCountsRef.current || lockedTileCountsRef.current.length === 0) {
          lockedTileCountsRef.current = effectiveRows.map((row) => row.tileCount);
        }
        if (!lockedTileCounts || lockedTileCounts.length !== effectiveRows.length) {
          lockedTileCountsRef.current = nextLayouts.map((layout) => layout.activeColumns.length);
        }

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
          setCurrentMultiplier(sessionMatch.currentMultiplier ?? 1);
        } else {
          setActiveRowIndex(0);
          // Don't reset status if the game was completed (won or lost) and finalized
          const completion = gameCompletionRef.current;
          const isCompleted = (completion.status === "won" || completion.status === "lost") && completion.sessionId;
          if (!isCompleted) {
            setStatus("idle");
            setLostRow(null);
            setShowGameOver(false);
            setHasStarted(false);
            setBetAmount(null);
          }
          // Always reset these regardless of completion status
          pendingSessionRef.current = null;
          setPendingSession(null);
          setCurrentMultiplier(1);
        }
        setVerificationStatus("idle");
        setVerificationOutput(null);
        setClientSeedInput(seedPayload.clientSeed ?? "");
        setPendingRange(normalizedRange);
        setTileRange(normalizedRange);
      } catch (error) {
        console.error("[Bomb Game] Failed to build round:", error);
      } finally {
        setIsBuildingRound(false);
      }
    },
    [],
  );

  const requestSessionSeeds = useCallback(
    async (
      clientSeedOverride?: string,
      rangeOverride?: { min: number; max: number },
      lockedCountsOverride?: number[] | null,
    ): Promise<string | null> => {
      const range = rangeOverride ?? tileRangeRef.current;
      const lockedCounts =
        typeof lockedCountsOverride !== "undefined"
          ? lockedCountsOverride
          : lockedTileCountsRef.current;
      const body = {
        address: activeAddress,
        clientSeed: clientSeedOverride,
        tileRange: range,
        lockedTileCounts: lockedCounts ?? undefined,
      };

      const response = await fetch("/api/degenshoot/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data || data.success === false) {
        throw new Error(data?.error ?? "Unknown session error");
      }

      const nextSessionId = data.sessionId ?? null;
      const layoutRows = Array.isArray(data.rows) ? data.rows : [];
      if (!layoutRows.length) {
        throw new Error("Invalid layout response");
      }

      lockedTileCountsRef.current = Array.isArray(data.lockedTileCounts)
        ? data.lockedTileCounts.map((value: number) => Number(value))
        : layoutRows.map((row: any) => Number(row.tileCount));

      setIsSessionStuck(false);
      setBetError((prev) => (prev && prev.includes("Session") ? null : prev));

      setSessionId(nextSessionId);
      // Note: We intentionally don't clear finalizedSessionId here
      // This preserves the finalized session after cash out, allowing Reveal Fairness to work
      console.log("[DEBUG] requestSessionSeeds - NOT clearing finalizedSessionId");
      pendingSessionRef.current = null;
      setPendingSession(null);
      setCurrentMultiplier(1);

      const sanitizedRows = layoutRows.map((row: any, idx: number) => {
        const tileCountRaw = Number(row.tileCount);
        const tileCount =
          Number.isFinite(tileCountRaw) && tileCountRaw >= MIN_TILE_OPTION
            ? Math.floor(tileCountRaw)
            : MIN_TILE_OPTION;
        const bombsPerRowRaw = Number(row.bombsPerRow);
        const bombsPerRow =
          Number.isFinite(bombsPerRowRaw) && bombsPerRowRaw > 0
            ? Math.floor(bombsPerRowRaw)
            : BOMBS_PER_ROW;
        const maybeMultiplier = Number(row.rowMultiplier);
        const rowMultiplier =
          Number.isFinite(maybeMultiplier) && maybeMultiplier > 0
            ? maybeMultiplier
            : calculateRowMultiplier(tileCount, bombsPerRow, HOUSE_EDGE);
        const probabilities = Array.from({ length: tileCount }, (_, tileIndex) => ({
          tileIndex,
          bomb: bombsPerRow / tileCount,
          safe: 1 - bombsPerRow / tileCount,
        }));

        return {
          rowIndex: Number.isInteger(row.rowIndex) ? Number(row.rowIndex) : idx,
          nonce: Number(row.nonce) || 0,
          gameHash: String(row.gameHash ?? ""),
          tileCount,
          bombIndex: -1,
          rowMultiplier,
          bombsPerRow,
          probabilities,
        };
      });

      await buildRowsWithSeeds(
        {
          serverSeed: data.serverSeed ?? null,
          serverSeedHash: data.serverSeedHash ?? "",
          clientSeed: data.clientSeed ?? null,
          nonceBase: data.nonceBase ?? 0,
        },
        range,
        lockedTileCountsRef.current,
        sanitizedRows,
      );

      return nextSessionId;
    },
    [activeAddress, buildRowsWithSeeds],
  );

  const restartStuckSession = useCallback(async () => {
    if (isOnchainBusy) return;
    try {
      saveStoredSession(null, normalizedActiveAddress);
      pendingSessionRef.current = null;
      setPendingSession(null);
      lockedTileCountsRef.current = null;
      setHasStarted(false);
      setBetAmount(null);
      setStatus("idle");
      setLostRow(null);
      setShowGameOver(false);
      setSessionId(null);
      console.log("[DEBUG] restartStuckSession - Clearing finalizedSessionId");
      setFinalizedSessionId(null);
      setRoundSummary(null);
      setRows([]);
      setActiveRowIndex(-1);
      setCurrentMultiplier(1);
      setBetError(null);
      await requestSessionSeeds(currentClientSeed ?? undefined, undefined, null);
      setIsSessionStuck(false);
    } catch (error) {
      console.error("[Bomb Game] Failed to restart session:", error);
      setBetError((error as Error).message ?? "Failed to restart session");
      setIsSessionStuck(true);
    }
  }, [
    isOnchainBusy,
    normalizedActiveAddress,
    requestSessionSeeds,
    currentClientSeed,
  ]);

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
        rowStatus = row.isCompleted ? "completed" : "locked";
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

  const potentialPayout = useMemo(() => {
    if (!hasStarted || !betAmount) return null;
    return betAmount * currentMultiplier;
  }, [betAmount, currentMultiplier, hasStarted]);

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

  const canCashOut = useMemo(() => {
    if (!hasStarted) return false;
    if (status === "lost" || status === "won") return false;
    return currentMultiplier > 1;
  }, [hasStarted, status, currentMultiplier]);

  const canReveal = useMemo(() => {
    if (!fairnessState || fairnessState.revealed) return false;
    const sessionKey = finalizedSessionId ?? sessionId;
    if (!sessionKey) return false;
    // Allow reveal if status is lost/won, OR if there's a finalized session (game is complete)
    return status === "lost" || status === "won" || Boolean(finalizedSessionId);
  }, [fairnessState, finalizedSessionId, sessionId, status]);

  const cashOutAmount = useMemo(() => {
    if (!canCashOut || !betAmount) return null;
    return betAmount * currentMultiplier;
  }, [canCashOut, betAmount, currentMultiplier]);

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
    if (!node) return;

    node.scrollIntoView({ block: "center", behavior: "smooth" });
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
    // Only scroll to bottom when game starts (hasStarted becomes true)
    // After that, the activeRowIndex effect will handle scrolling to current row
    if (effectiveFullscreen && containerRef.current && hasStarted && activeRowIndex === 0) {
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
  }, [effectiveFullscreen, hasStarted, activeRowIndex]);

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

  useEffect(() => {
    if (!fairnessState || !hasStarted) {
      return;
    }
    if (status !== "idle" || !sessionId) {
      saveStoredSession(null, normalizedActiveAddress);
      return;
    }
    const rawBet = betAmount ?? Number(betInput);
    const normalizedBet =
      typeof rawBet === "number" && Number.isFinite(rawBet) && rawBet >= MIN_BET_AMOUNT
        ? rawBet
        : MIN_BET_AMOUNT;

    const session: StoredSession = {
      sessionId,
      finalizedSessionId,
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
      currentMultiplier,
      roundSummary,
    };
    saveStoredSession(session, normalizedActiveAddress);
  }, [
    hasStarted,
    status,
    activeRowIndex,
    lostRow,
    rows,
    fairnessState,
    betAmount,
    betInput,
    sessionId,
    currentMultiplier,
    finalizedSessionId,
    roundSummary,
    normalizedActiveAddress,
  ]);

  useEffect(() => {
    hasInitialisedRef.current = false;
    pendingSessionRef.current = null;
    lockedTileCountsRef.current = null;
    setSessionId(null);
    setHasStarted(false);
    setStatus("idle");
    setLostRow(null);
    setShowGameOver(false);
    setRows([]);
    setActiveRowIndex(-1);
    setFairnessState(null);
    console.log("[DEBUG] Address change useEffect - Clearing finalizedSessionId for address:", normalizedActiveAddress);
    setFinalizedSessionId(null);
    setRoundSummary(null);
  }, [normalizedActiveAddress]);

  useEffect(() => {
    if (hasInitialisedRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const stored = loadStoredSession(normalizedActiveAddress);
        if (stored && stored.fairness) {
          if (cancelled) return;
          const storedFairness: FairnessState = {
            ...stored.fairness,
            revealed: Boolean(stored.fairness.revealed ?? stored.fairness.serverSeed),
          };

          const sessionSnapshot: StoredSession = {
            ...stored,
            fairness: storedFairness,
          };

          setPendingSession(sessionSnapshot);
          pendingSessionRef.current = sessionSnapshot;
          setBetInput(stored.betAmount.toString());
          setBetAmount(stored.betAmount);
          setSessionId(stored.sessionId ?? null);
          setFinalizedSessionId(stored.finalizedSessionId ?? null);
          setCurrentMultiplier(stored.currentMultiplier ?? 1);
          setRoundSummary(stored.roundSummary ?? null);
          lockedTileCountsRef.current = storedFairness.rowsMeta.map((meta) => meta.tileCount);
          await buildRowsWithSeeds(
            {
              serverSeed: storedFairness.serverSeed,
              serverSeedHash: storedFairness.serverSeedHash,
              clientSeed: storedFairness.clientSeed,
              nonceBase: storedFairness.nonceBase,
            },
            tileRangeRef.current,
            lockedTileCountsRef.current,
            storedFairness.rowsMeta,
          );
          setIsSessionStuck(false);
        } else {
          if (cancelled) return;
          lockedTileCountsRef.current = null;
          await requestSessionSeeds(undefined, undefined, null);
        }
      } catch (error) {
        console.error("[Bomb Game] Unable to initialise round:", error);
      } finally {
        if (!cancelled) {
          hasInitialisedRef.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildRowsWithSeeds, requestSessionSeeds, normalizedActiveAddress]);

  const rerollTiles = useCallback(async () => {
    if (isRoundInProgress) {
      setBetError("Finish or cash out the current round before rerolling.");
      return;
    }
    try {
      saveStoredSession(null, normalizedActiveAddress);
      lockedTileCountsRef.current = null;
      await requestSessionSeeds(currentClientSeed ?? undefined, undefined, null);
    } catch (error) {
      console.error("[Bomb Game] Failed to reroll tiles:", error);
    }
  }, [
    requestSessionSeeds,
    currentClientSeed,
    normalizedActiveAddress,
    isRoundInProgress,
  ]);

  const submitOnchainResult = useCallback(
    async (roundStatus: GameStatus) => {
      if (!onchainReady || !wallet || !activeAddress || !DEGENSHOOT_ADDRESS) {
        return;
      }
      const activeSessionId = sessionId ?? finalizedSessionId;
      if (!activeSessionId || !betAmount) {
        return;
      }

      try {
        setIsOnchainBusy(true);
        setWithdrawTxHash(null);

        if (walletChainId && walletChainId !== DEGENSHOOT_CHAIN_ID) {
          await wallet.switchChain(desiredChainHex);
        }

        const provider = await wallet.getEthereumProvider();
        const account = activeAddress as Address;
        const walletClient = createWalletClient({
          account,
          chain: DEGENSHOOT_CHAIN,
          transport: custom(provider),
        });

        const computedCompletedRows = lastCompletedStat?.rowNumber ?? 0;
        const summary =
          roundSummary ?? {
            xp: Math.max(10, computedCompletedRows * 100),
            kills: computedCompletedRows,
            timeAlive: Math.max(1, computedCompletedRows * 30),
            score: Math.max(1, Math.round(currentMultiplier * 1000)),
            multiplier: computedCompletedRows > 0 ? currentMultiplier : 1,
            completedRows: computedCompletedRows,
          };
        const completedRows = summary.completedRows;
        const cumulativeMultiplier =
          completedRows > 0 ? summary.multiplier : 1;

        const multiplierX100 = Math.max(
          1,
          Math.round(cumulativeMultiplier * 100),
        );

        const xpAward = summary.xp;
        const scoreEstimate = summary.score;
        const killsEstimate = summary.kills;
        const timeAliveEstimate = summary.timeAlive;
        const wagerWei = parseEther(betAmount.toString());

        const resultDeadline = BigInt(Math.floor(Date.now() / 1000) + 600);
        const xpDeadline = resultDeadline + 300n;

        const response = await fetch("/api/degenshoot/sign", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: activeSessionId,
            user: activeAddress,
            score: scoreEstimate,
            kills: killsEstimate,
            timeAlive: timeAliveEstimate,
            wagerWei: wagerWei.toString(),
            multiplierX100: multiplierX100.toString(),
            xp: xpAward.toString(),
            deadline: Number(resultDeadline),
            xpDeadline: Number(xpDeadline),
          }),
        });

        if (!response.ok) {
          throw new Error(`Signer API error (${response.status})`);
        }

        const signaturePayload = await response.json();
        if (signaturePayload?.success === false) {
          throw new Error(signaturePayload?.error ?? "Failed to sign result");
        }

        try {
          await degenshootPublicClient.simulateContract({
            address: DEGENSHOOT_ADDRESS,
            abi: DEGENSHOOT_ABI,
            functionName: "submitResultAndClaimXP",
            args: [
              {
                user: activeAddress as Address,
                gameId: DEGENSHOOT_GAME_ID_BIGINT,
                sessionId: BigInt(activeSessionId),
                score: BigInt(scoreEstimate),
                kills: BigInt(killsEstimate),
                timeAlive: BigInt(timeAliveEstimate),
                wager: wagerWei,
                multiplierX100: BigInt(multiplierX100),
                xp: BigInt(xpAward),
                deadline: BigInt(signaturePayload?.deadline ?? resultDeadline),
              },
              signaturePayload.resultSignature as `0x${string}`,
              BigInt(signaturePayload?.xpDeadline ?? xpDeadline),
              signaturePayload.xpSignature as `0x${string}`,
            ],
            account,
          });
        } catch (simulationError) {
          let revertError: ContractFunctionRevertedError | undefined;
          if (simulationError instanceof BaseError) {
            simulationError.walk((err) => {
              if (err instanceof ContractFunctionRevertedError) {
                revertError = err;
                return true;
              }
              return false;
            });
          }

          let decoded: { errorName?: string; args?: readonly unknown[] } | null = null;
          let rawData: Hex | undefined;

          if (revertError) {
            if (revertError.data && typeof revertError.data === "object") {
              decoded = {
                errorName: revertError.data.errorName,
                args: revertError.data.args,
              };
            }
            if (typeof revertError.raw === "string" && revertError.raw.startsWith("0x")) {
              rawData = revertError.raw as Hex;
            }
            if (!decoded && rawData && rawData !== "0x") {
              try {
                const result = decodeErrorResult({
                  abi: XP_REGISTRY_ABI,
                  data: rawData,
                });
                decoded = {
                  errorName: result.errorName,
                  args: result.args,
                };
              } catch (decodeErr) {
                console.log("[BombGame] decodeErrorResult failed", decodeErr);
              }
            }
          }

          console.log({
            error: simulationError,
            shortMessage:
              revertError?.shortMessage ??
              (simulationError instanceof Error ? simulationError.message : undefined),
            reason: revertError?.reason,
            raw: rawData,
            decoded,
          });
          console.error("[Bomb Game] Result simulation failed:", simulationError);
          if (decoded?.errorName) {
            const argsText = decoded.args?.length
              ? `(${decoded.args.map(String).join(", ")})`
              : "";
            setBetError(`${decoded.errorName}${argsText}`);
          } else {
            setBetError(
              simulationError instanceof Error
                ? simulationError.message
                : "Transaction simulation failed",
            );
          }
          setIsOnchainBusy(false);
          return;
        }

        const txHash = await walletClient.writeContract({
          address: DEGENSHOOT_ADDRESS,
          abi: DEGENSHOOT_ABI,
          functionName: "submitResultAndClaimXP",
          args: [
            {
              user: activeAddress as Address,
              gameId: DEGENSHOOT_GAME_ID_BIGINT,
              sessionId: BigInt(activeSessionId),
              score: BigInt(scoreEstimate),
              kills: BigInt(killsEstimate),
              timeAlive: BigInt(timeAliveEstimate),
              wager: wagerWei,
              multiplierX100: BigInt(multiplierX100),
              xp: BigInt(xpAward),
              deadline: BigInt(signaturePayload?.deadline ?? resultDeadline),
            },
            signaturePayload.resultSignature as `0x${string}`,
            BigInt(signaturePayload?.xpDeadline ?? xpDeadline),
            signaturePayload.xpSignature as `0x${string}`,
          ],
          account,
        });

        setResultTxHash(txHash);
        try {
          await degenshootPublicClient.waitForTransactionReceipt({ hash: txHash });
        } catch (receiptError) {
          console.warn("[Bomb Game] Waiting for result confirmation failed:", receiptError);
        }

        let startedWithdraw = false;
        try {
          if (WAGER_VAULT_ADDRESS) {
            startedWithdraw = true;
            setIsWithdrawing(true);
            console.log("[Bomb Game] Checking vault balance before withdraw…");
            const pendingBalance = (await wagerVaultPublicClient.readContract({
              address: WAGER_VAULT_ADDRESS,
              abi: WAGER_VAULT_ABI,
              functionName: "balances",
              args: [account],
            })) as bigint;

            if (pendingBalance > 0n) {
              console.log("[Bomb Game] Pending payout detected:", pendingBalance.toString());
              const vaultClient = createWalletClient({
                account,
                chain: WAGER_VAULT_CHAIN,
                transport: custom(provider),
              });
              const withdrawHash = await vaultClient.writeContract({
                address: WAGER_VAULT_ADDRESS,
                abi: WAGER_VAULT_ABI,
                functionName: "withdraw",
                args: [pendingBalance],
                account,
              });
              console.log("[Bomb Game] Withdraw transaction submitted:", withdrawHash);
              setWithdrawTxHash(withdrawHash);
              try {
                await wagerVaultPublicClient.waitForTransactionReceipt({ hash: withdrawHash });
                console.log("[Bomb Game] Withdraw transaction confirmed");
              } catch (withdrawReceiptError) {
                console.warn("[Bomb Game] Waiting for withdraw confirmation failed:", withdrawReceiptError);
              }
            } else {
              console.log("[Bomb Game] No pending payout, skipping withdraw");
            }
          }
        } catch (withdrawError) {
          console.error("[Bomb Game] Failed to withdraw payout:", withdrawError);
          setBetError((withdrawError as Error).message ?? "Failed to withdraw payout");
        } finally {
          if (startedWithdraw) {
            setIsWithdrawing(false);
          }
        }

        setHasStarted(false);
        setSessionId(null);
        // DON'T clear finalizedSessionId here! Users need it to verify the round after cashing out
        // setFinalizedSessionId(null);
        console.log("[DEBUG] finalizeResult - Preserving finalizedSessionId for verification");
        setCurrentMultiplier(1);
        // DON'T clear roundSummary either, users might want to see it
        // setRoundSummary(null);
        saveStoredSession(null, normalizedActiveAddress);
      } catch (error) {
        console.error("[Bomb Game] Failed to finalise result:", error);
        if (error instanceof Error && error.message.includes("404")) {
          setBetError("Session expired. Please restart the game.");
          setIsSessionStuck(true);
        } else if (error instanceof BaseError) {
          let friendly = error.shortMessage ?? error.message;
          error.walk((err) => {
            if (err instanceof ContractFunctionRevertedError) {
              friendly = err.shortMessage ?? err.message ?? friendly;
              if (err.reason) {
                friendly += `: ${err.reason}`;
              }
              if (err.data?.errorName) {
                friendly += ` (${err.data.errorName})`;
              }
              return true;
            }
            return false;
          });
          setBetError(friendly);
        } else {
          setBetError((error as Error).message ?? "Failed to submit result");
        }
      } finally {
        setIsOnchainBusy(false);
      }
    },
    [
      onchainReady,
      wallet,
      activeAddress,
      DEGENSHOOT_ADDRESS,
      sessionId,
      betAmount,
    walletChainId,
    desiredChainHex,
    lastCompletedStat,
    rowStats,
    currentMultiplier,
    roundSummary,
    finalizedSessionId,
    normalizedActiveAddress,
  ],
  );

  const playAgain = useCallback(() => {
    setStatus("idle");
    setShowGameOver(false);
    setLostRow(null);
    setHasStarted(false);
    setActiveRowIndex(0);
    setSessionId(null);
    console.log("[DEBUG] playAgain - Clearing finalizedSessionId (user starting new game)");
    setFinalizedSessionId(null);
    setRoundSummary(null);
    pendingSessionRef.current = null;
    saveStoredSession(null, normalizedActiveAddress);
    setIsSessionStuck(false);
  }, [normalizedActiveAddress]);

  const dismissGameOver = useCallback(() => {
    setShowGameOver(false);
  }, []);

  useEffect(() => {
    resultSubmittedRef.current = false;
    setResultTxHash(null);
    setBetTxHash(null);
    if (sessionId) {
      setWithdrawTxHash(null);
      setIsWithdrawing(false);
    }
  }, [sessionId]);

  const applyTileRange = useCallback(async () => {
    if (!fairnessState) return;
    if (isRoundInProgress || isOnchainBusy) {
      setBetError("Finish or cash out the current round before changing tiles.");
      return;
    }
    const appliedValue = {
      min: pendingRange.min,
      max: pendingRange.max,
    };
    try {
      setTileRange(appliedValue);
      saveStoredSession(null, normalizedActiveAddress);
      lockedTileCountsRef.current = null;
      await requestSessionSeeds(currentClientSeed ?? undefined, appliedValue, null);
    } finally {
      setShowCustomizer(false);
    }
  }, [
    currentClientSeed,
    normalizedActiveAddress,
    pendingRange,
    requestSessionSeeds,
    isRoundInProgress,
    isOnchainBusy,
  ]);

  const useDefaultTileRange = useCallback(async () => {
    if (!fairnessState) return;
    if (isRoundInProgress || isOnchainBusy) {
      setBetError("Finish or cash out the current round before changing tiles.");
      return;
    }
    try {
      const resetRange = { ...DEFAULT_TILE_RANGE };
      setTileRange(resetRange);
      setPendingRange(resetRange);
      saveStoredSession(null, normalizedActiveAddress);
      lockedTileCountsRef.current = null;
      await requestSessionSeeds(currentClientSeed ?? undefined, resetRange, null);
    } finally {
      setShowCustomizer(false);
    }
  }, [currentClientSeed, normalizedActiveAddress, requestSessionSeeds, isRoundInProgress, isOnchainBusy]);

  const applyClientSeed = useCallback(async () => {
    if (!fairnessState) return;
    if (isRoundInProgress || isOnchainBusy) {
      setBetError("Finish or cash out the current round before changing tiles.");
      return;
    }
    const nextSeed = clientSeedInput.trim();
    if (!nextSeed) return;
    saveStoredSession(null, normalizedActiveAddress);
    lockedTileCountsRef.current = null;
    await requestSessionSeeds(nextSeed, tileRange, null);
  }, [normalizedActiveAddress, requestSessionSeeds, clientSeedInput, tileRange, fairnessState, isRoundInProgress, isOnchainBusy]);

  const randomizeClientSeed = useCallback(() => {
    const newSeed = randomHex(16);
    setClientSeedInput(newSeed);
  }, []);

  const verifyRound = useCallback(async () => {
    if (
      !fairnessState ||
      !fairnessState.revealed ||
      !fairnessState.serverSeed ||
      !fairnessState.clientSeed
    ) {
      setVerificationStatus("error");
      setVerificationOutput(null);
      return;
    }
    setIsVerifying(true);
    try {
      const results: VerificationRowOutput[] = [];
      for (const row of fairnessState.rowsMeta) {
        if (row.bombIndex < 0) continue;
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

      if (results.length === 0) {
        setVerificationStatus("error");
        setVerificationOutput(null);
        return;
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
    const activeSessionKey = finalizedSessionId ?? sessionId;
    if (!fairnessState || !activeSessionKey) {
      setVerificationStatus("error");
      setVerificationOutput(null);
      return;
    }

    setIsRevealing(true);

    try {
      const response = await fetch("/api/degenshoot/reveal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: activeSessionKey,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (!payload || payload.success === false) {
        throw new Error(payload?.error ?? "Reveal failed");
      }

      const revealedRows = Array.isArray(payload.rows) ? payload.rows : [];
      const revealedMeta = revealedRows.map((row: any, idx: number) => {
        const tileCountRaw = Number(row.tileCount);
        const tileCount =
          Number.isFinite(tileCountRaw) && tileCountRaw >= MIN_TILE_OPTION
            ? Math.floor(tileCountRaw)
            : MIN_TILE_OPTION;
        const bombsPerRowRaw = Number(row.bombsPerRow);
        const bombsPerRow =
          Number.isFinite(bombsPerRowRaw) && bombsPerRowRaw > 0
            ? Math.floor(bombsPerRowRaw)
            : BOMBS_PER_ROW;
        const probabilities = Array.isArray(row.probabilities)
          ? row.probabilities.map((entry: any) => ({
              tileIndex: Number(entry.tileIndex) || 0,
              bomb: Number(entry.bomb) || bombsPerRow / tileCount,
              safe: Number(entry.safe) || 1 - bombsPerRow / tileCount,
            }))
          : Array.from({ length: tileCount }, (_, tileIndex) => ({
              tileIndex,
              bomb: bombsPerRow / tileCount,
              safe: 1 - bombsPerRow / tileCount,
            }));

        const rowMultiplierRaw = Number(row.rowMultiplier);
        const rowMultiplier =
          Number.isFinite(rowMultiplierRaw) && rowMultiplierRaw > 0
            ? rowMultiplierRaw
            : calculateRowMultiplier(tileCount, bombsPerRow, HOUSE_EDGE);

        return {
          rowIndex: Number.isInteger(row.rowIndex) ? Number(row.rowIndex) : idx,
          nonce: Number(row.nonce) || 0,
          gameHash: String(row.gameHash ?? ""),
          tileCount,
          bombIndex: Number.isInteger(row.bombIndex) ? Number(row.bombIndex) : -1,
          rowMultiplier,
          bombsPerRow,
          probabilities,
        };
      });

      if (revealedMeta.length === 0) {
        throw new Error("Invalid reveal payload");
      }

      const revealedMap = new Map<number, RowFairnessMeta>(
        revealedMeta.map((meta: any) => [meta.rowIndex, meta]),
      );

      setFairnessState((prev) => {
        const previous = prev ?? fairnessState;
        const mergedRows =
          previous?.rowsMeta?.map((meta) => revealedMap.get(meta.rowIndex) ?? meta) ??
          revealedMeta;
        return {
          serverSeed: payload.serverSeed ?? null,
          serverSeedHash: payload.serverSeedHash ?? previous?.serverSeedHash ?? "",
          clientSeed: payload.clientSeed ?? null,
          nonceBase: payload.nonceBase ?? previous?.nonceBase ?? 0,
          rowsMeta: mergedRows,
          revealed: true,
        };
      });

      setRows((prev) =>
        prev.map((layout) => {
          const nextMeta = revealedMap.get(layout.fairness.rowIndex);
          if (!nextMeta) return layout;
          return {
            ...layout,
            fairness: nextMeta,
          };
        }),
      );

      if (payload.roundSummary) {
        setRoundSummary({
          xp: Number(payload.roundSummary.xp) || 0,
          kills: Number(payload.roundSummary.kills) || 0,
          timeAlive: Number(payload.roundSummary.timeAlive) || 0,
          score: Number(payload.roundSummary.score) || 0,
          multiplier: Number(payload.roundSummary.multiplier) || 1,
          completedRows: Number(payload.roundSummary.completedRows) || 0,
        });
      }

      setVerificationStatus("idle");
      setVerificationOutput(null);
    } catch (error) {
      console.error("[Bomb Game] Failed to reveal fairness:", error);
      setVerificationStatus("error");
      setVerificationOutput(null);
    } finally {
      setIsRevealing(false);
    }
  }, [fairnessState, finalizedSessionId, sessionId]);

  const handleStartGame = useCallback(async () => {
    if (isWithdrawing) {
      setBetError("Finishing previous payout, please wait.");
      return;
    }
    const parsed = Number(betInput);
    if (!Number.isFinite(parsed) || parsed < MIN_BET_AMOUNT) {
      setBetError(`Minimum bet is ${MIN_BET_AMOUNT} ETH`);
      return;
    }

    // Check balance before attempting transaction
    if (onchainReady && typeof balanceNumeric === "number" && balanceNumeric < parsed) {
      setBetError("Insufficient balance. Please add more funds or reduce your bet amount.");
      return;
    }

    if (!onchainReady) {
      setBetError(null);
      setBetAmount(parsed);
      setCurrentMultiplier(1);
      setHasStarted(true);
      if (status === "lost" || status === "won") {
        setStatus("idle");
        setLostRow(null);
        setShowGameOver(false);
      }
      return;
    }

    if (!wallet || !activeAddress || !WAGER_VAULT_ADDRESS) {
      setBetError("Connect a wallet to place an on-chain bet");
      return;
    }

    try {
      setIsOnchainBusy(true);
      setWithdrawTxHash(null);
      setBetError(null);

      let currentSession = sessionId;
      if (!currentSession) {
        const lockedCounts = lockedTileCountsRef.current;
        const lockedRange =
          lockedCounts && lockedCounts.length > 0
            ? {
                min: Math.min(...lockedCounts),
                max: Math.max(...lockedCounts),
              }
            : undefined;
        currentSession = await requestSessionSeeds(
          currentClientSeed ?? undefined,
          lockedRange,
          lockedCounts ?? null,
        );
      }

      if (!currentSession) {
        setIsOnchainBusy(false);
        setBetError("Unable to initialise game session. Please try again.");
        return;
      }

      setCurrentMultiplier(1);

      if (walletChainId && walletChainId !== DEGENSHOOT_CHAIN_ID) {
        await wallet.switchChain(desiredChainHex);
      }

      const provider = await wallet.getEthereumProvider();
      const account = activeAddress as Address;
      const walletClient = createWalletClient({
        account,
        chain: WAGER_VAULT_CHAIN,
        transport: custom(provider),
      });

      const valueWei = parseEther(parsed.toString());
      const wagerWeiString = valueWei.toString();

      const txHash = await walletClient.writeContract({
        address: WAGER_VAULT_ADDRESS,
        abi: WAGER_VAULT_ABI,
        functionName: "placeBet",
        args: [BigInt(currentSession)],
        value: valueWei,
        account,
      });

      setBetTxHash(txHash);

      try {
        await wagerVaultPublicClient.waitForTransactionReceipt({ hash: txHash });
      } catch (receiptError) {
        console.warn("[Bomb Game] Waiting for bet confirmation failed:", receiptError);
      }

      const registerWager = async (attempt: number): Promise<void> => {
        const MAX_ATTEMPTS = 25;
        const baseDelay = 1500;

        try {
          const registerResponse = await fetch("/api/degenshoot/action", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId: currentSession,
              action: "registerWager",
              wagerWei: wagerWeiString,
              address: activeAddress,
              txHash,
            }),
          });

          if (!registerResponse.ok) {
            const payload = await registerResponse.json().catch(() => null);
            const errorCode =
              typeof payload?.error === "string" ? payload.error : `HTTP_${registerResponse.status}`;
            if (
              attempt < MAX_ATTEMPTS &&
              (errorCode === "WAGER_NOT_FOUND_ONCHAIN" ||
                errorCode === "WAGER_VERIFICATION_FAILED" ||
                registerResponse.status === 502)
            ) {
              await new Promise((resolve) => {
                const delay = baseDelay + baseDelay * attempt;
                setTimeout(resolve, delay);
              });
              return registerWager(attempt + 1);
            }
            throw new Error(
              typeof payload?.error === "string" ? payload.error : `HTTP ${registerResponse.status}`,
            );
          }
        } catch (registerError) {
          if (attempt >= MAX_ATTEMPTS - 1) {
            throw registerError;
          }
          await new Promise((resolve) => {
            const delay = baseDelay + baseDelay * attempt;
            setTimeout(resolve, delay);
          });
          return registerWager(attempt + 1);
        }
      };

      try {
        await registerWager(0);
      } catch (registerError) {
        console.error("[Bomb Game] Failed to register wager:", registerError);
        setBetError(
          (registerError as Error).message ??
            "Failed to confirm wager on-chain. Please wait a moment and try again.",
        );
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
    } catch (error) {
      console.error("[Bomb Game] Failed to place bet:", error);

      // Extract user-friendly error message
      let errorMessage = "Transaction failed";
      const errorString = error instanceof Error ? error.message : String(error);
      const errorStringLower = errorString.toLowerCase();

      if (errorStringLower.includes("insufficient funds") ||
          errorStringLower.includes("exceeds the balance")) {
        errorMessage = "Insufficient balance. Please add more funds or reduce your bet amount.";
      } else if (errorStringLower.includes("user rejected") ||
                 errorStringLower.includes("user denied")) {
        errorMessage = "Transaction cancelled by user.";
      } else if (errorStringLower.includes("network") ||
                 errorStringLower.includes("connection")) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (errorStringLower.includes("gas")) {
        errorMessage = "Gas estimation failed. Please try again.";
      } else {
        // For other errors, use a shortened version if the message is too long
        errorMessage = errorString.length > 100
          ? `${errorString.substring(0, 100)}...`
          : errorString;
      }

      setBetError(errorMessage);
    } finally {
      setIsOnchainBusy(false);
    }
  }, [
    betInput,
    balanceNumeric,
    onchainReady,
    wallet,
    activeAddress,
    WAGER_VAULT_ADDRESS,
    sessionId,
    requestSessionSeeds,
    currentClientSeed,
    walletChainId,
    desiredChainHex,
    status,
    isWithdrawing,
  ]);

  const handleTileClick = useCallback(
    (rowIndex: number, column: number) => {
      if (!hasStarted) return;
      if (status === "lost" || status === "won") return;
      if (rowIndex !== activeRowIndex) return;
      const currentRow = rows[rowIndex];
      if (!currentRow) return;
      if (currentRow.selectedColumn !== null) return;
      const relativeColumn = currentRow.activeColumns.indexOf(column);
      if (relativeColumn < 0) return;
      if (!sessionId) {
        setBetError("Round not initialised");
        return;
      }

      void (async () => {
        try {
          const response = await fetch("/api/degenshoot/action", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId,
              action: "selectTile",
              column: relativeColumn,
              address: activeAddress,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const payload = await response.json();
          if (!payload?.success) {
            throw new Error(payload?.error ?? "Action failed");
          }

          const nextStatus: GameStatus =
            payload.status === "completed" || payload.status === "cashout"
              ? "won"
              : payload.status === "lost"
              ? "lost"
              : status;

          if (payload.result === "safe") {
            const selectedRelative =
              typeof payload.selectedColumn === "number" && payload.selectedColumn >= 0
                ? payload.selectedColumn
                : relativeColumn;
            const selectedBoardColumn =
              currentRow.activeColumns[selectedRelative] ?? column;
            setRows((prev) =>
              prev.map((row, idx) =>
                idx === rowIndex
                  ? {
                      ...row,
                      selectedColumn: selectedBoardColumn,
                      crashed: false,
                      isCompleted: true,
                    }
                  : row,
              ),
            );
            if (typeof payload.nextRowIndex === "number") {
              setActiveRowIndex(payload.nextRowIndex);
            }
            setCurrentMultiplier(payload.currentMultiplier ?? currentMultiplier);
            setStatus(nextStatus);
            if (nextStatus === "won") {
              setShowGameOver(true);
              setFinalizedSessionId(sessionId);
              setSessionId(null);
              if (!resultSubmittedRef.current) {
                resultSubmittedRef.current = true;
                void submitOnchainResult("won").finally(() => {
                  resultSubmittedRef.current = false;
                });
              }
            }
          } else if (payload.result === "bomb") {
            const bombRelative =
              typeof payload.bombColumn === "number" && payload.bombColumn >= 0
                ? payload.bombColumn
                : currentRow.fairness.bombIndex;
            setRows((prev) =>
              prev.map((row, idx) =>
                idx === rowIndex
                  ? {
                      ...row,
                      selectedColumn: currentRow.activeColumns[relativeColumn] ?? column,
                      crashed: true,
                      isCompleted: false,
                      fairness: {
                        ...row.fairness,
                        bombIndex: bombRelative,
                      },
                    }
                  : row,
              ),
            );
            setFairnessState((prev) => {
              if (!prev) return prev;
              const updated = prev.rowsMeta.map((meta, idx) =>
                idx === rowIndex
                  ? {
                      ...meta,
                      bombIndex: bombRelative,
                    }
                  : meta,
              );
              return { ...prev, rowsMeta: updated };
            });
            setStatus("lost");
            setLostRow(rowIndex);
            setShowGameOver(true);
            setFinalizedSessionId(sessionId);
            setSessionId(null);
          }

          if (payload.summary) {
            setRoundSummary(payload.summary);
          }
        } catch (error) {
          console.error("[Bomb Game] Failed to resolve tile:", error);
          if (error instanceof Error && error.message.includes("404")) {
            setBetError("Session expired. Please restart the game.");
            setIsSessionStuck(true);
          } else {
            setBetError((error as Error).message ?? "Failed to resolve tile");
          }
        }
      })();
    },
    [
      hasStarted,
      status,
      activeRowIndex,
      rows,
      sessionId,
      activeAddress,
      currentMultiplier,
      submitOnchainResult,
    ],
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

  const handleCashOut = useCallback(() => {
    if (!canCashOut) return;
    if (!sessionId) {
      setBetError("Round not initialised");
      return;
    }

    void (async () => {
      try {
        const response = await fetch("/api/degenshoot/action", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            action: "cashOut",
            address: activeAddress,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (!payload?.success) {
          throw new Error(payload?.error ?? "Unable to cash out");
        }

        if (payload.summary) {
          setRoundSummary(payload.summary);
        }

        setStatus("won");
        setShowGameOver(true);
        setActiveRowIndex(-1);
        setHasStarted(true);
        console.log("[DEBUG] handleCashOut - Setting finalizedSessionId to:", sessionId);
        setFinalizedSessionId(sessionId);
        setSessionId(null);

        if (!resultSubmittedRef.current) {
          resultSubmittedRef.current = true;
          void submitOnchainResult("won").finally(() => {
            resultSubmittedRef.current = false;
          });
        }
      } catch (error) {
        console.error("[Bomb Game] Cash out failed:", error);
        if (error instanceof Error && error.message.includes("404")) {
          setBetError("Session expired. Please restart the game.");
          setIsSessionStuck(true);
        } else {
          setBetError((error as Error).message ?? "Failed to cash out");
        }
      }
    })();
  }, [
    canCashOut,
    sessionId,
    activeAddress,
    normalizedActiveAddress,
    submitOnchainResult,
  ]);

  const openCustomizer = useCallback(() => {
    setPendingRange(tileRange);
    setShowCustomizer(true);
  }, [tileRange]);

  const closeCustomizer = useCallback(() => {
    setShowCustomizer(false);
  }, []);

  const openInfo = useCallback(() => setShowInfo(true), []);
  const closeInfo = useCallback(() => setShowInfo(false), []);

  const isStartDisabled =
    !isWalletConnected ||
    needsChainSwitch ||
    isSessionStuck ||
    isRoundInProgress ||
    isBuildingRound ||
    isOnchainBusy ||
    isWithdrawing;

  let startLabel: string;
  if (!isWalletConnected) {
    startLabel = "Please connect wallet";
  } else if (needsChainSwitch) {
    startLabel = `Switch to ${targetChainLabel}`;
  } else if (isSessionStuck) {
    startLabel = "Session expired";
  } else if (isWithdrawing) {
    startLabel = "Processing payout...";
  } else if (isOnchainBusy) {
    startLabel = "Processing...";
  } else if (isRoundInProgress) {
    startLabel = "In Progress";
  } else {
    startLabel = "Start Round";
  }

  const startHelperText = !isWalletConnected
    ? "Please connect wallet"
    : needsChainSwitch
    ? `Switch to ${targetChainLabel}`
    : isSessionStuck
    ? "Session expired. Please restart the game."
    : null;

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
    potentialPayout,
    currentMultiplier,
    betAmount,
    betInput,
    betError,
    updateBetInput,
    quickBet,
    handleStartGame,
    cashOutAmount,
    handleCashOut,
    canCashOut,
    isStartDisabled,
    startLabel,
    betAmountValue: betAmount,
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
    isVerifying,
    isRevealing,
    verificationStatus,
    verificationOutput,
    revealFairness,
    verifyRound,
    isBuildingRound,
    rerollTiles,
    handleTileClick,
    playAgain,
    dismissGameOver,
    sessionId,
    finalizedSessionId,
    betTxHash,
    resultTxHash,
    withdrawTxHash,
    isOnchainBusy,
    isWithdrawing,
    roundSummary,
    canReveal,
    isRoundInProgress,
    startHelperText,
    needsChainSwitch,
    switchToGameChain,
    targetChainLabel,
    isWalletConnected,
    isSessionStuck,
    restartStuckSession,
  };
}
