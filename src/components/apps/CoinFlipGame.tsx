"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import clsx from "clsx";
import TerminalHeader from "@/components/terminal/TerminalHeader";
import { useDock } from "@/context/DockContext";
import { useResponsive } from "@/hooks/useResponsive";
import { base, baseSepolia } from "viem/chains";
import {
  parseEther,
  BaseError,
  ContractFunctionRevertedError,
  formatEther,
  type Address,
} from "viem";
import {
  MIN_BET,
  PRESET_MULTIPLIERS,
  deriveAllowedMultipliers,
  requiredBetForMultiplier,
} from "@/lib/games/coinflip/config";
import { useEOA } from "@/hooks/useEOA";
import useSmartWallet from "@/hooks/useSmartWallet";
import { useBalance } from "wagmi";
import {
  COINFLIP_ADDRESS,
  COINFLIP_CHAIN_ID,
  COINFLIP_FEATURES_ENABLED,
  COINFLIP_VAULT_ADDRESS,
} from "@/lib/contracts/addresses";
import {
  COINFLIP_ABI,
  COINFLIP_GAME_ID_BIGINT,
  coinFlipPublicClient,
  createCoinFlipWalletClient,
} from "@/lib/contracts/coinflip";
import {
  COINFLIP_VAULT_ABI,
  coinFlipVaultPublicClient,
  createCoinFlipVaultWalletClient,
} from "@/lib/contracts/coinFlipVault";
import { mapOutcomeToEnum } from "@/lib/games/coinflip/fairness";
import {
  COINFACE_BACKDROP,
  FLOAT_FLIP_ANIMATION,
  FLOAT_IDLE_ANIMATION,
  MAX_HISTORY_ENTRIES,
} from "./coinflip/constants";
import type { CoinVariantKey } from "./coinflip/constants";
import type {
  CoinFlipHistoryRecord,
  CoinFlipSessionStatus,
  FlipHistoryEntry,
  OutcomeBanner,
  RevealInfo,
  RoundSummary,
  VerifySubject,
} from "./coinflip/types";
import { CoinFlipHeader } from "./coinflip/CoinFlipHeader";
import { CoinFlipHistory } from "./coinflip/CoinFlipHistory";
import { CoinFlipVisualPanel } from "./coinflip/CoinFlipVisualPanel";
import { CoinFlipBetControls } from "./coinflip/CoinFlipBetControls";
import { CoinFlipMultiplierControls } from "./coinflip/CoinFlipMultiplierControls";
import {
  CoinFlipOutcomePopup,
  type OutcomePopupState,
} from "./coinflip/CoinFlipOutcomePopup";
import { CoinFlipVerifyModal } from "./coinflip/CoinFlipVerifyModal";
import { CoinFlipNetworkGate } from "./coinflip/CoinFlipNetworkGate";
export default function CoinFlipGameWindow() {
  const {
    coinFlipState: { open, minimized, fullscreen, version },
    closeCoinFlip,
    minimizeCoinFlip,
    toggleFullscreenCoinFlip,
  } = useDock();

  if (!open) return null;

  return (
    <CoinFlipGameContent
      key={version}
      minimized={minimized}
      fullscreen={fullscreen}
      onClose={closeCoinFlip}
      onMinimize={minimizeCoinFlip}
      onToggleFullscreen={toggleFullscreenCoinFlip}
    />
  );
}

type CoinFlipGameContentProps = {
  minimized: boolean;
  fullscreen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onToggleFullscreen: () => void;
};

function CoinFlipGameContent({
  minimized,
  fullscreen,
  onClose,
  onMinimize,
  onToggleFullscreen,
}: CoinFlipGameContentProps) {
  const { isMobile } = useResponsive();
  const windowRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [dockOffset, setDockOffset] = useState(112);
  const [betInput, setBetInput] = useState(() => MIN_BET.toFixed(3));
  const [betError, setBetError] = useState<string | null>(null);
  const [selectedMultiplier, setSelectedMultiplier] = useState<number>(
    PRESET_MULTIPLIERS[0]
  );
  const [isCustomMultiplier, setIsCustomMultiplier] = useState(false);
  const [customMultiplierInput, setCustomMultiplierInput] = useState("");
  const [multiplierError, setMultiplierError] = useState<string | null>(null);
  const [userChoice, setUserChoice] = useState<"Heads" | "Tails">("Heads");
  const [currentResult, setCurrentResult] = useState<FlipHistoryEntry["result"] | null>(null);
  const [lastGuess, setLastGuess] = useState<FlipHistoryEntry["guess"] | null>(null);
  const [history, setHistory] = useState<FlipHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [outcomePopup, setOutcomePopup] = useState<OutcomePopupState | null>(null);
  const [payoutTxBySession, setPayoutTxBySession] = useState<Record<string, string>>({});
  const [sessionStatus, setSessionStatus] = useState<CoinFlipSessionStatus>("idle");
  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);
  const [lastCompletedSessionId, setLastCompletedSessionId] = useState<string | null>(null);
  const [revealInfo, setRevealInfo] = useState<RevealInfo | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [awaitingBalanceRefresh, setAwaitingBalanceRefresh] = useState(false);
  const [statusMessageTimeout, setStatusMessageTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [lastCashoutHash, setLastCashoutHash] = useState<string | null>(null);
  const [verifySubject, setVerifySubject] = useState<VerifySubject | null>(null);

  const sessionRef = useRef<{
    id: string;
    serverSeedHash: string;
    clientSeed: string;
  } | null>(null);

  const { selectedWallet } = useEOA();
  const { smartAccountAddress } = useSmartWallet();
  const wallet = selectedWallet ?? null;
  const activeAddress = (selectedWallet?.address ?? smartAccountAddress) as `0x${string}` | undefined;

  const {
    data: balanceData,
    isLoading: isBalanceLoading,
    isFetching: isBalanceFetching,
    refetch: refetchBalance,
  } = useBalance({
    address: activeAddress,
    chainId: COINFLIP_CHAIN_ID,
    query: {
      enabled: Boolean(activeAddress),
      refetchInterval: 15_000,
    },
  });

  const normalizedActiveAddress = activeAddress?.toLowerCase() ?? null;

  const formatEth = useCallback((value: number) => {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: value < 0.01 ? 4 : 3,
      maximumFractionDigits: 6,
    });
  }, []);

  const formatMultiplier = useCallback((value: number) => {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }, []);

  const formatTimeAgo = useCallback((timestamp: number) => {
    if (!Number.isFinite(timestamp)) return "—";
    const now = Date.now();
    const diffMs = now - timestamp;
    if (!Number.isFinite(diffMs) || diffMs < 0) return "just now";
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
  }, []);

  const shortenHash = useCallback((hash: string | null | undefined) => {
    if (!hash) return null;
    return hash.length > 18 ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : hash;
  }, []);

  const clampPosition = useCallback(
    (next: { x: number; y: number }) => {
      if (typeof window === "undefined") return next;
      const node = windowRef.current;
      const w = node?.offsetWidth ?? 0;
      const h = node?.offsetHeight ?? 0;
      const maxX = Math.max(window.innerWidth - w, 0);
      const maxY = Math.max(window.innerHeight - dockOffset - h, 0);
      return {
        x: Math.min(Math.max(next.x, 0), maxX),
        y: Math.min(Math.max(next.y, 0), maxY),
      };
    },
    [dockOffset]
  );

  const resolveSessionId = useCallback(
    (
      sessionId: string | number | null | undefined,
      fallbackId?: number
    ): string | null => {
      if (sessionId !== null && sessionId !== undefined && sessionId !== "") {
        return String(sessionId);
      }
      if (
        typeof fallbackId === "number" &&
        Number.isFinite(fallbackId) &&
        fallbackId > 0
      ) {
        return String(fallbackId);
      }
      return null;
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const computeDockOffset = () => {
      const dockElement = document.querySelector<HTMLElement>(
        "[data-onboarding-id='dock']"
      );
      const height = dockElement?.getBoundingClientRect().height ?? 0;
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      const margin = isDesktop ? 48 : 24;
      const nextOffset = Math.max(96, Math.round(height + margin));
      setDockOffset(nextOffset);
      setPos((prev) => clampPosition(prev));
    };
    computeDockOffset();
    window.addEventListener("resize", computeDockOffset);
    return () => window.removeEventListener("resize", computeDockOffset);
  }, [clampPosition]);

  const betValue = useMemo(() => {
    const parsed = Number.parseFloat(betInput);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }, [betInput]);

  const allowedPresetMultipliers = useMemo(
    () => deriveAllowedMultipliers(betValue),
    [betValue]
  );

  const customMultiplierValue = useMemo(() => {
    if (!isCustomMultiplier) return null;
    const parsed = Number.parseFloat(customMultiplierInput);
    return Number.isFinite(parsed) ? parsed : null;
  }, [customMultiplierInput, isCustomMultiplier]);

  const activeMultiplier = isCustomMultiplier
    ? customMultiplierValue ?? Number.NaN
    : selectedMultiplier;

  const potentialPayout =
    Number.isFinite(betValue) && Number.isFinite(activeMultiplier)
      ? betValue * (activeMultiplier as number)
      : null;

  const walletChainId = useMemo(() => {
    if (!wallet?.chainId) return null;
    const parts = wallet.chainId.split(":");
    const maybe = parts[parts.length - 1];
    const parsed = Number(maybe);
    return Number.isFinite(parsed) ? parsed : null;
  }, [wallet]);

  const desiredChainHex = useMemo(
    () => `0x${COINFLIP_CHAIN_ID.toString(16)}` as `0x${string}`,
    []
  );

  const targetChainLabel = useMemo(() => {
    if (COINFLIP_CHAIN_ID === base.id) return "Base";
    if (COINFLIP_CHAIN_ID === baseSepolia.id) return "Base Sepolia";
    return `Chain ${COINFLIP_CHAIN_ID}`;
  }, []);

  const explorerBaseUrl = useMemo(() => {
    if (COINFLIP_CHAIN_ID === baseSepolia.id) return "https://sepolia.basescan.org";
    if (COINFLIP_CHAIN_ID === base.id) return "https://basescan.org";
    return null;
  }, []);

  const recordPayoutTx = useCallback(
    (sessionId: string, txHash: string) => {
      if (!sessionId || !txHash) return;
      setPayoutTxBySession((prev) => ({
        ...prev,
        [sessionId]: txHash,
      }));
      void fetch("/api/coinflip/history/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, txHash }),
      }).catch((error) => {
        console.warn("[CoinFlip] Failed to persist payout tx hash:", error);
      });
    },
    []
  );

  const isWalletConnected = Boolean(wallet && activeAddress);
  const needsChainSwitch =
    isWalletConnected && walletChainId !== null && walletChainId !== COINFLIP_CHAIN_ID;

  const onchainReady =
    COINFLIP_FEATURES_ENABLED &&
    Boolean(wallet && activeAddress && COINFLIP_ADDRESS && COINFLIP_VAULT_ADDRESS);

  useEffect(() => {
    if (!Number.isFinite(betValue)) {
      setBetError("Enter a bet amount first");
      return;
    }
    if (betValue < MIN_BET) {
      setBetError(`Minimum bet ${MIN_BET.toFixed(3)} ETH`);
      return;
    }
    setBetError(null);
  }, [betValue]);

  useEffect(() => {
    if (isCustomMultiplier) return;
    if (!Number.isFinite(betValue) || betValue < MIN_BET) return;
    if (
      allowedPresetMultipliers.length > 0 &&
      !allowedPresetMultipliers.includes(selectedMultiplier)
    ) {
      setSelectedMultiplier(
        allowedPresetMultipliers[allowedPresetMultipliers.length - 1]
      );
    }
  }, [allowedPresetMultipliers, betValue, isCustomMultiplier, selectedMultiplier]);

  useEffect(() => {
    if (isCustomMultiplier && customMultiplierInput.trim().length === 0) {
      setMultiplierError("Enter a custom multiplier");
      return;
    }

    if (!Number.isFinite(activeMultiplier) || (activeMultiplier as number) <= 1) {
      setMultiplierError("Multiplier must be at least x2");
      return;
    }

    if (!Number.isFinite(betValue) || betValue < MIN_BET) {
      setMultiplierError(null);
      return;
    }

    const requiredBet = requiredBetForMultiplier(activeMultiplier as number);
    if (betValue + Number.EPSILON < requiredBet) {
      setMultiplierError(
        `Bet at least ${requiredBet.toFixed(3)} ETH for multiplier x${formatMultiplier(activeMultiplier as number)}`
      );
      return;
    }

    setMultiplierError(null);
  }, [activeMultiplier, betValue, customMultiplierInput, formatMultiplier, isCustomMultiplier]);

  const betValid =
    Number.isFinite(betValue) && betValue >= MIN_BET && !betError;
  const multiplierValid =
    Number.isFinite(activeMultiplier) &&
    Number.isFinite(betValue) &&
    betValue >= requiredBetForMultiplier(activeMultiplier as number) &&
    !multiplierError;
  const highestAllowedPreset =
    allowedPresetMultipliers.length > 0
      ? allowedPresetMultipliers[allowedPresetMultipliers.length - 1]
      : null;

  const effectiveFullscreen = fullscreen || isMobile;

  const initPos = useCallback(() => {
    if (typeof window === "undefined" || effectiveFullscreen) return;
    const node = windowRef.current;
    if (!node) return;
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    const initial = clampPosition({
      x: Math.max((window.innerWidth - w) / 2, 0),
      y: Math.max((window.innerHeight - dockOffset - h) / 2, 0),
    });
    setPos(initial);
    setIsReady(true);
  }, [clampPosition, dockOffset, effectiveFullscreen]);

  useEffect(() => {
    const frame = requestAnimationFrame(initPos);
    return () => cancelAnimationFrame(frame);
  }, [initPos]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      if (effectiveFullscreen) return;
      setPos((prev) => clampPosition(prev));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampPosition, effectiveFullscreen]);

  useEffect(() => {
    if (!effectiveFullscreen) {
      setIsReady(false);
    }
  }, [effectiveFullscreen]);

  const switchToGameChain = useCallback(async () => {
    if (!wallet) return;
    try {
      await wallet.switchChain(desiredChainHex);
      setBetError(null);
      setStatusOverride(null);
    } catch (error) {
      console.error("[CoinFlip] Failed to switch chain:", error);
      const message = (error as Error)?.message ?? "Failed to switch network";
      setBetError(message);
      throw new Error(message);
    }
  }, [wallet, desiredChainHex]);

  const handleNetworkSwitch = useCallback(() => {
    void switchToGameChain().catch(() => undefined);
  }, [switchToGameChain]);

  const resetSession = useCallback(() => {
    sessionRef.current = null;
    setSessionStatus("idle");
    setRoundSummary(null);
    setStatusOverride(null);
    setRevealInfo(null);
    setShowVerifyModal(false);
    setVerifyError(null);
    setVerifyLoading(false);
    setOutcomePopup(null);
    setVerifySubject(null);
    setLastCashoutHash(null);
    setCurrentResult(null);
    setLastGuess(null);
  }, []);

  useEffect(() => {
    resetSession();
  }, [normalizedActiveAddress, resetSession]);

  const ensureSession = useCallback(async () => {
    if (sessionRef.current && sessionStatus !== "submitted") {
      return sessionRef.current;
    }
    if (!activeAddress) {
      throw new Error("Connect a wallet to start a coin flip session.");
    }
    const response = await fetch("/api/coinflip/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: activeAddress }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error ?? `Failed to start session (HTTP ${response.status})`);
    }
    const next = {
      id: String(payload.sessionId),
      serverSeedHash: String(payload.serverSeedHash),
      clientSeed: String(payload.clientSeed),
    };
    sessionRef.current = next;
    setSessionStatus("ready");
    return next;
  }, [activeAddress, sessionStatus]);

  const placeBetOnchain = useCallback(
    async (session: { id: string }, wagerValue: bigint) => {
      if (!wallet || !activeAddress) {
        throw new Error("Connect a wallet to place a bet.");
      }
      if (!COINFLIP_VAULT_ADDRESS || !COINFLIP_ADDRESS) {
        throw new Error("CoinFlip contracts are not configured.");
      }
      if (!onchainReady) {
        throw new Error("CoinFlip on-chain features are unavailable.");
      }
      if (needsChainSwitch) {
        await switchToGameChain();
      }
      setStatusOverride("Confirm the bet transaction in your wallet…");
      const provider = await wallet.getEthereumProvider();
      const account = activeAddress as Address;
      const walletClient = createCoinFlipVaultWalletClient(provider, account);
      const txHash = await walletClient.writeContract({
        address: COINFLIP_VAULT_ADDRESS,
        abi: COINFLIP_VAULT_ABI,
        functionName: "placeBet",
        args: [BigInt(session.id)],
        value: wagerValue,
        account,
      });
      setStatusOverride("Verifying bet on-chain…");
      try {
        await coinFlipVaultPublicClient.waitForTransactionReceipt({ hash: txHash });
      } catch (error) {
        console.warn("[CoinFlip] Waiting for bet confirmation failed:", error);
      }

      const payload = {
        sessionId: session.id,
        action: "registerWager" as const,
        wagerWei: wagerValue.toString(),
        address: activeAddress,
        txHash,
      };

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await fetch("/api/coinflip/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await response.json().catch(() => null);
        const actionFailed =
          response.status === 409 ||
          response.status === 425 ||
          response.status === 500 ||
          json?.error === "ACTION_FAILED";
        if (response.ok && json?.success) {
          setSessionStatus("wagerRegistered");
          return;
        }
        const retryable =
          response.status === 409 ||
          response.status === 425 ||
          response.status === 502 ||
          json?.error === "WAGER_NOT_FOUND_ONCHAIN" ||
          json?.error === "WAGER_VERIFICATION_FAILED" ||
          json?.error === "WAGER_CONFIRMATION_PENDING" ||
          actionFailed;
        if (retryable && attempt < 5) {
          await new Promise((resolve) => setTimeout(resolve, 1500 + attempt * 400));
          continue;
        }
        const message = actionFailed
          ? "CoinFlip service is still processing the last flip. Please wait a moment and try again."
          : json?.error ?? `Failed to register wager (HTTP ${response.status})`;
        throw new Error(message);
      }
      throw new Error("Failed to confirm wager on-chain. Please try again.");
    },
    [wallet, activeAddress, onchainReady, needsChainSwitch, switchToGameChain]
  );

  const flipRound = useCallback(
    async (
      session: { id: string },
      guess: "Heads" | "Tails",
      multiplier: number
    ) => {
      const response = await fetch("/api/coinflip/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          action: "flip",
          guess,
          multiplier,
          address: activeAddress,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.success) {
        throw new Error(json?.error ?? `Flip failed (HTTP ${response.status})`);
      }
      return json;
    },
    [activeAddress]
  );

  const revealSession = useCallback(
    async (session: { id: string; historyId?: number | string | null }) => {
      const applyRevealPayload = (payload: any) => {
        if (!payload?.success) {
          return payload;
        }
        const roundData = payload.roundSummary ?? payload.summary ?? null;
        const info: RevealInfo = {
          serverSeed: String(payload.serverSeed ?? ""),
          clientSeed: String(payload.clientSeed ?? ""),
          serverSeedHash: String(payload.serverSeedHash ?? ""),
          outcome: (roundData?.outcome ?? roundSummary?.outcome ?? "Heads") as "Heads" | "Tails",
        };
        setRevealInfo(info);
        if (sessionRef.current) {
          sessionRef.current = {
            ...sessionRef.current,
            clientSeed: info.clientSeed,
            serverSeedHash: info.serverSeedHash,
          };
        }
        return payload;
      };

      const postJson = async (url: string) => {
        try {
          const payload: Record<string, unknown> = { sessionId: session.id };
          if (session.historyId !== undefined && session.historyId !== null) {
            payload.historyId = session.historyId;
          }
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = await response.json().catch(() => null);
          return { response, json };
        } catch (error) {
          console.warn("[CoinFlip] Reveal request failed:", error);
          return { response: null, json: null };
        }
      };

      const primary = await postJson("/api/coinflip/reveal");
      if (primary.json?.success) {
        return applyRevealPayload(primary.json);
      }

      const shouldFallback =
        primary.response?.status === 404 ||
        primary.json?.error === "SESSION_NOT_FOUND";

      if (shouldFallback) {
        const fallback = await postJson("/api/coinflip/history/verify");
        return applyRevealPayload(fallback.json);
      }

      return primary.json;
    },
    [roundSummary]
  );

  const submitResult = useCallback(
    async (
      session: { id: string },
      summary: {
        guess: "Heads" | "Tails";
        outcome: "Heads" | "Tails";
        multiplierX100: number;
        xp: number;
      },
      wagerValue: bigint
    ) => {
      if (!wallet || !activeAddress || !COINFLIP_ADDRESS) {
        throw new Error("Connect a wallet to submit the result.");
      }
      const response = await fetch("/api/coinflip/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          user: activeAddress,
          multiplierX100: summary.multiplierX100,
          outcome: summary.outcome,
          xp: summary.xp,
          guess: summary.guess,
          wagerWei: wagerValue.toString(),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error ?? `Signing failed (HTTP ${response.status})`);
      }

      const provider = await wallet.getEthereumProvider();
      const account = activeAddress as Address;
      const walletClient = createCoinFlipWalletClient(provider, account);

      const guessEnum = mapOutcomeToEnum(summary.guess);
      const outcomeEnum = mapOutcomeToEnum(summary.outcome);
      const deadline = BigInt(payload?.deadline ?? Math.floor(Date.now() / 1000) + 600);
      const xpDeadline = BigInt(payload?.xpDeadline ?? Math.floor(Date.now() / 1000) + 900);

      console.log({COINFLIP_ADDRESS},{COINFLIP_GAME_ID_BIGINT},{activeAddress},{wagerValue},{payloadsignature: payload.resultSignature},{xpDeadline},{payloadxpsignature: payload.xpSignature} )
      try {
        await coinFlipPublicClient.simulateContract({
          address: COINFLIP_ADDRESS,
          abi: COINFLIP_ABI,
          functionName: "submitResultAndClaimXP",
          args: [
            {
              user: activeAddress as Address,
              gameId: COINFLIP_GAME_ID_BIGINT,
              sessionId: BigInt(session.id),
              guess: BigInt(guessEnum),
              outcome: BigInt(outcomeEnum),
              wager: wagerValue,
              multiplierX100: BigInt(summary.multiplierX100),
              xp: BigInt(summary.xp),
              deadline,
            },
            payload.resultSignature as `0x${string}`,
            xpDeadline,
            payload.xpSignature as `0x${string}`,
          ],
          account,
        });
      } catch (error) {
        if (error instanceof BaseError) {
          let revert: ContractFunctionRevertedError | undefined;
          error.walk((inner) => {
            if (inner instanceof ContractFunctionRevertedError) {
              revert = inner;
              return true;
            }
            return false;
          });
          const reason =
            revert?.shortMessage ?? revert?.message ?? error.shortMessage ?? error.message;
          throw new Error(reason ?? "Transaction simulation failed");
        }
        throw error;
      }

      const submitHash = await walletClient.writeContract({
        address: COINFLIP_ADDRESS,
        abi: COINFLIP_ABI,
        functionName: "submitResultAndClaimXP",
        args: [
          {
            user: activeAddress as Address,
            gameId: COINFLIP_GAME_ID_BIGINT,
            sessionId: BigInt(session.id),
            guess: BigInt(guessEnum),
            outcome: BigInt(outcomeEnum),
            wager: wagerValue,
            multiplierX100: BigInt(summary.multiplierX100),
            xp: BigInt(summary.xp),
            deadline,
          },
          payload.resultSignature as `0x${string}`,
          xpDeadline,
          payload.xpSignature as `0x${string}`,
        ],
        account,
      });

      if (summary.multiplierX100 > 0) {
        setLastCashoutHash(submitHash);
        recordPayoutTx(String(session.id), submitHash);
      }

      setStatusOverride("Waiting for result confirmation…");
      try {
        await coinFlipPublicClient.waitForTransactionReceipt({ hash: submitHash });
      } catch (error) {
        console.warn("[CoinFlip] Waiting for result confirmation failed:", error);
      }

      if (summary.multiplierX100 > 0 && COINFLIP_VAULT_ADDRESS) {
        try {
          const pendingBalance = (await coinFlipVaultPublicClient.readContract({
            address: COINFLIP_VAULT_ADDRESS,
            abi: COINFLIP_VAULT_ABI,
            functionName: "balances",
            args: [account],
          })) as bigint;

          if (pendingBalance > 0n) {
            const vaultLiquidity = await coinFlipVaultPublicClient.getBalance({
              address: COINFLIP_VAULT_ADDRESS,
            });

            if (vaultLiquidity < pendingBalance) {
              console.warn(
                "[CoinFlip] Vault liquidity insufficient for auto-withdraw. Pending:",
                pendingBalance.toString(),
                "available:",
                vaultLiquidity.toString(),
              );
              setStatusOverride(
                "Payout ready. Vault is restocking – withdraw from history when funds arrive.",
              );
              return;
            }

            const vaultClient = createCoinFlipVaultWalletClient(provider, account);
            const withdrawHash = await vaultClient.writeContract({
              address: COINFLIP_VAULT_ADDRESS,
              abi: COINFLIP_VAULT_ABI,
              functionName: "withdraw",
              args: [pendingBalance],
              account,
            });
            setLastCashoutHash(withdrawHash);
            recordPayoutTx(String(session.id), withdrawHash);
            try {
              await coinFlipVaultPublicClient.waitForTransactionReceipt({ hash: withdrawHash });
            } catch (error) {
              console.warn("[CoinFlip] Waiting for withdraw confirmation failed:", error);
            }
          }
        } catch (error) {
          console.error("[CoinFlip] Failed to withdraw payout:", error);
        }
      }
    },
    [wallet, activeAddress, recordPayoutTx]
  );

  const refreshHistory = useCallback(async () => {
    if (!activeAddress) {
      setHistory([]);
      return;
    }
    try {
      const params = new URLSearchParams({ address: activeAddress });
      const response = await fetch(`/api/coinflip/history?${params.toString()}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success === false || !Array.isArray(payload?.entries)) {
        return;
      }
      const entries: CoinFlipHistoryRecord[] = payload.entries as CoinFlipHistoryRecord[];
      const updates: Record<string, string> = {};
      const mapped: FlipHistoryEntry[] = entries.map((entry) => {
        let betValue = 0;
        try {
          betValue = Number(formatEther(BigInt(entry.wagerWei ?? "0")));
        } catch {
          betValue = 0;
        }
        const createdAt = entry.createdAt ? new Date(entry.createdAt).getTime() : Date.now();
        const selectedMultiplier = Number(entry.selectedMultiplier ?? 0) / 100;
        const payoutMultiplier = Number(entry.payoutMultiplier ?? 0) / 100;
        const sessionKey = entry.sessionId ?? String(entry.id ?? createdAt);
        const result = entry.outcome === "Tails" ? "Tails" : ("Heads" as "Heads" | "Tails");
        const guess = entry.guess === "Tails" ? "Tails" : ("Heads" as "Heads" | "Tails");
        const storedTxHash = entry.payoutTxHash ?? null;
        const stateTxHash = payoutTxBySession[sessionKey] ?? null;
        const payoutTxHash = stateTxHash ?? storedTxHash ?? null;
        if (storedTxHash && storedTxHash !== stateTxHash) {
          updates[sessionKey] = storedTxHash;
        }
        return {
          id: Number(entry.id ?? createdAt),
          sessionId: entry.sessionId ?? null,
          result,
          guess,
          bet: betValue,
          selectedMultiplier,
          payoutMultiplier,
          xp: Number(entry.xp ?? 0),
          timestamp: createdAt,
          payoutTxHash,
        };
      });
      setHistory(mapped.slice(0, MAX_HISTORY_ENTRIES));
      if (Object.keys(updates).length > 0) {
        setPayoutTxBySession((prev) => ({ ...prev, ...updates }));
      }
    } catch (error) {
      console.error("[CoinFlip] Failed to load history:", error);
    }
  }, [activeAddress, payoutTxBySession]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (!historyOpen) return;
    void refreshHistory();
  }, [historyOpen, refreshHistory]);

  const headsCount = useMemo(
    () => history.filter((entry) => entry.result === "Heads").length,
    [history]
  );
  const tailsCount = history.length - headsCount;
  const wins = useMemo(
    () => history.filter((entry) => entry.payoutMultiplier > 0).length,
    [history]
  );
  const losses = history.length - wins;
  const totalWagered = useMemo(
    () => history.reduce((acc, entry) => acc + entry.bet, 0),
    [history]
  );
  const totalWinningPayout = useMemo(
    () => history.reduce((acc, entry) => acc + entry.bet * entry.payoutMultiplier, 0),
    [history]
  );
  const totalProfit = totalWinningPayout - totalWagered;

  const lastOutcome = useMemo(() => {
    if (roundSummary) {
      const { outcome, guess, correct } = roundSummary;
      return {
        correct,
        result: outcome,
        guess,
        message: correct
          ? `${outcome}! You guessed correctly.`
          : `${outcome}! Your guess was ${guess}. Try again.`,
      };
    }
    if (!currentResult || !lastGuess) return null;
    const correct = currentResult === lastGuess;
    return {
      correct,
      result: currentResult,
      guess: lastGuess,
      message: correct
        ? `${currentResult}! You guessed correctly.`
        : `${currentResult}! Your guess was ${lastGuess}. Try again.`,
    };
  }, [currentResult, lastGuess, roundSummary]);

  const outcomeBanner: OutcomeBanner | null = useMemo(() => {
    if (!roundSummary) return null;
    const { outcome, xp, multiplierX100 } = roundSummary;
    const win = multiplierX100 > 0;
    const payoutMultiplier = multiplierX100 / 100;
    return {
      win,
      outcome,
      xp,
      cashoutHash: win ? lastCashoutHash ?? undefined : undefined,
      payoutText: win
        ? `Payout x${payoutMultiplier.toFixed(payoutMultiplier < 10 ? 2 : 0)}`
        : undefined,
      className: win
        ? "bg-emerald-500/15 text-emerald-200 border border-emerald-400/50"
        : "bg-rose-500/15 text-rose-200 border border-rose-400/50",
      message: win
        ? `You won! Outcome ${outcome}.`
        : `Missed it. Outcome ${outcome}.`,
    };
  }, [roundSummary, lastCashoutHash]);

  useEffect(() => {
    if (!outcomeBanner) return;
    setOutcomePopup({
      win: outcomeBanner.win,
      message: outcomeBanner.message,
      xp: outcomeBanner.xp,
      payoutText: outcomeBanner.payoutText,
      cashoutHash: outcomeBanner.cashoutHash,
    });
  }, [outcomeBanner]);

useEffect(() => {
  if (!outcomePopup) return;
  if (outcomePopup.cashoutHash) return;
  const timeout = window.setTimeout(() => setOutcomePopup(null), 4000);
  return () => window.clearTimeout(timeout);
}, [outcomePopup]);

  useEffect(() => {
    if (!awaitingBalanceRefresh) return;
    if (!isBalanceLoading && !isBalanceFetching) {
      setAwaitingBalanceRefresh(false);
    }
  }, [awaitingBalanceRefresh, isBalanceFetching, isBalanceLoading]);

  const balanceDisplay = useMemo(() => {
    if (!balanceData?.value) return null;
    try {
      return `${formatEth(Number(formatEther(balanceData.value)))} ETH`;
    } catch {
      return null;
    }
  }, [balanceData?.value, formatEth]);

  const hasSufficientBalance = useMemo(() => {
    if (!balanceData?.value) return false;
    if (!Number.isFinite(betValue)) return true;
    try {
      const requiredWei = parseEther(betValue.toString());
      return balanceData.value >= requiredWei;
    } catch {
      return false;
    }
  }, [balanceData?.value, betValue]);

  const coinFloatAnimation = isFlipping ? FLOAT_FLIP_ANIMATION : FLOAT_IDLE_ANIMATION;
  const activeVariant: CoinVariantKey = isFlipping
    ? "flipping"
    : currentResult === "Tails"
    ? "tails"
    : "heads";

  const effectiveStatusOverride = awaitingBalanceRefresh
    ? "Refreshing balance…"
    : statusOverride;

  const statusMessage = isFlipping
    ? effectiveStatusOverride ?? "Processing coin flip…"
    : effectiveStatusOverride ??
      betError ??
      multiplierError ??
      (!hasSufficientBalance && betValid ? "Insufficient balance." : null) ??
      (needsChainSwitch ? `Switch to ${targetChainLabel} to play CoinFlip.` : null) ??
      lastOutcome?.message ??
      "Pick a side, set your bet, then flip the coin.";

  const statusTone = isFlipping
    ? "text-slate-300"
    : betError || multiplierError
    ? "text-rose-300"
    : statusOverride
    ? "text-slate-200"
    : !hasSufficientBalance && betValid
    ? "text-rose-300"
    : needsChainSwitch
    ? "text-amber-300"
    : lastOutcome
    ? lastOutcome.correct
      ? "text-emerald-300"
      : "text-rose-300"
    : "text-slate-300";

  const clearStatusTimeout = useCallback(() => {
    if (statusMessageTimeout) {
      clearTimeout(statusMessageTimeout);
      setStatusMessageTimeout(null);
    }
  }, [statusMessageTimeout]);

  const setTemporaryStatus = useCallback(
    (message: string, duration = 4000) => {
      clearStatusTimeout();
      setStatusOverride(message);
      const timeout = setTimeout(() => setStatusOverride(null), duration);
      setStatusMessageTimeout(timeout);
    },
    [clearStatusTimeout]
  );

  const handleFlip = useCallback(async () => {
    if (isFlipping || !betValid || !multiplierValid) return;
    if (!isWalletConnected) {
      setBetError("Connect a wallet to flip the coin.");
      return;
    }
    if (!onchainReady) {
      setBetError("CoinFlip contracts are not available.");
      return;
    }
    if (needsChainSwitch) {
      setBetError(`Switch to ${targetChainLabel} to play CoinFlip.`);
      return;
    }

    setBetError(null);
    setStatusOverride("Starting coin flip…");
    setIsFlipping(true);
    setLastCashoutHash(null);
    setRoundSummary(null);
    setCurrentResult(null);
    setLastGuess(null);
    setOutcomePopup(null);
    setRevealInfo(null);

    try {
      const session = await ensureSession();
      const betAmount = Number.isFinite(betValue) ? Number(betValue) : MIN_BET;
      const selectedMultiplierValue = Number.isFinite(activeMultiplier)
        ? Number(activeMultiplier)
        : selectedMultiplier;
      const wagerValue = parseEther(betAmount.toString());

      await placeBetOnchain(session, wagerValue);

      const flipPayload = await flipRound(session, userChoice, selectedMultiplierValue);

      const nextResult = (flipPayload?.result ?? "Heads") as "Heads" | "Tails";
      const correct = Boolean(flipPayload?.correct);
      const multiplierX100 = Number(flipPayload?.multiplierX100 ?? 0);
      const xpAward = Number(flipPayload?.xp ?? (correct ? 250 : 100));

      const summary: RoundSummary = {
        guess: userChoice,
        outcome: nextResult,
        multiplierX100,
        xp: xpAward,
        correct,
      };

      setRoundSummary(summary);
      setVerifySubject({ ...summary, sessionId: String(session.id) });
      setCurrentResult(nextResult);
      setLastGuess(userChoice);
      setSessionStatus("flipped");
      setStatusOverride(
        correct
          ? "You guessed correctly! Settling result…"
          : "Wrong guess. Settling result…"
      );

      const submitPayload = {
        guess: summary.guess,
        outcome: summary.outcome,
        multiplierX100,
        xp: xpAward,
      };

      await submitResult(session, submitPayload, wagerValue);
      await revealSession(session);
      await refreshHistory();
      setLastCompletedSessionId(String(session.id));

      setSessionStatus("submitted");
      sessionRef.current = null;

      setTemporaryStatus(
        correct
          ? "Result submitted. XP will arrive shortly!"
          : "Result submitted. Better luck next flip!",
        4000
      );
      setAwaitingBalanceRefresh(true);
      void refetchBalance().catch(() => {
        setAwaitingBalanceRefresh(false);
        setStatusOverride("Balance refresh failed. Try again soon.");
      });
    } catch (error) {
      console.error("[CoinFlip] Flip failed:", error);
      const message = (error as Error)?.message ?? "Coin flip failed. Please try again.";
      setBetError(message);
      setAwaitingBalanceRefresh(false);
      resetSession();
    } finally {
      setIsFlipping(false);
    }
  }, [
    activeMultiplier,
    betValid,
    betValue,
    ensureSession,
    flipRound,
    isFlipping,
    isWalletConnected,
    multiplierValid,
    needsChainSwitch,
    onchainReady,
    placeBetOnchain,
    refetchBalance,
    refreshHistory,
    revealSession,
    resetSession,
    selectedMultiplier,
    submitResult,
    targetChainLabel,
    userChoice,
  ]);

  const handleVerifyHistoryEntry = useCallback(
    async (entry: FlipHistoryEntry) => {
      const targetSessionId = resolveSessionId(entry.sessionId, entry.id);
      if (!targetSessionId) {
        setVerifyError("Session data unavailable for this round.");
        setShowVerifyModal(true);
        return;
      }
      setVerifySubject({
        sessionId: targetSessionId,
        guess: entry.guess,
        outcome: entry.result,
        multiplierX100: Math.round(entry.selectedMultiplier * 100),
        xp: entry.xp,
        correct: entry.result === entry.guess,
      });
      setVerifyLoading(true);
      setRevealInfo(null);
      setVerifyError(null);
      try {
        setLastCompletedSessionId(targetSessionId);
        const result = await revealSession({ id: targetSessionId, historyId: entry.id });
        if (!result?.success) {
          throw new Error(result?.error ?? "Failed to reveal seeds.");
        }
        setShowVerifyModal(true);
      } catch (error) {
        const message = (error as Error)?.message ?? "Verification failed.";
        setVerifyError(
          message.toLowerCase().includes("session not found")
            ? "Session not found for this round. Refresh history and try again."
            : message
        );
        setShowVerifyModal(true);
      } finally {
        setVerifyLoading(false);
      }
    },
    [revealSession, resolveSessionId]
  );

  const handleVerifyModalClose = useCallback(() => {
    setShowVerifyModal(false);
    setVerifyError(null);
    setVerifyLoading(false);
    setRevealInfo(null);
    setVerifySubject(null);
  }, []);

  const toggleHistory = useCallback(() => {
    setHistoryOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    return () => clearStatusTimeout();
  }, [clearStatusTimeout]);

  if (minimized) return null;

  const windowClasses = clsx(
    "flex flex-col overflow-hidden bg-slate-950/95 pointer-events-auto",
    effectiveFullscreen
      ? "relative h-full w-full border-0 shadow-2xl md:w-[calc(100vw-4rem)] md:rounded-2xl md:border md:border-slate-800"
      : "mx-auto w-full rounded-2xl border border-slate-800 shadow-xl max-w-[calc(100vw-2.5rem)] sm:max-w-3xl xl:max-w-5xl"
  );

  const windowStyle = useMemo<CSSProperties>(
    () => ({
      maxHeight: effectiveFullscreen
        ? `calc(100vh - ${dockOffset}px)`
        : `min(calc(100vh - ${dockOffset}px), 700px)`,
      height: effectiveFullscreen ? "100%" : undefined,
    }),
    [dockOffset, effectiveFullscreen]
  );

  const outerStyle = useMemo<CSSProperties>(() => {
    if (effectiveFullscreen) {
      return {
        paddingBottom: `calc(${dockOffset}px + env(safe-area-inset-bottom, 0px))`,
      };
    }
    return {
      left: pos.x,
      top: pos.y,
      visibility: isReady ? "visible" : "hidden",
      maxHeight: `calc(100vh - ${dockOffset}px)`,
    };
  }, [dockOffset, effectiveFullscreen, isReady, pos.x, pos.y]);

  return (
    <div className="pointer-events-none">
      <div
        ref={windowRef}
        className={
          effectiveFullscreen
            ? "fixed inset-0 flex items-center justify-center pt-safe z-40"
            : "fixed px-4 z-40"
        }
        style={outerStyle}
      >
        <div
          className={windowClasses}
          style={{
            ...windowStyle,
            width: effectiveFullscreen ? undefined : "min(100%, 720px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div className="relative flex h-full min-h-0 flex-col">
            <div
              className={clsx(
                "flex h-full min-h-0 flex-col transition duration-150",
                needsChainSwitch && "pointer-events-none blur-sm"
              )}
            >
              <TerminalHeader
                onDragHandle={
                  needsChainSwitch
                    ? undefined
                    : (event) => {
                        if (effectiveFullscreen) return;
                        const rect = (
                          event.currentTarget.parentElement as HTMLElement
                        ).getBoundingClientRect();
                        const offsetX = event.clientX - rect.left;
                        const offsetY = event.clientY - rect.top;
                        setDragging(true);
                        const onMove = (ev: PointerEvent) => {
                          setPos(
                            clampPosition({
                              x: ev.clientX - offsetX,
                              y: ev.clientY - offsetY,
                            })
                          );
                        };
                        const onUp = () => {
                          setDragging(false);
                          window.removeEventListener("pointermove", onMove);
                          window.removeEventListener("pointerup", onUp);
                        };
                        window.addEventListener("pointermove", onMove, { passive: true });
                        window.addEventListener("pointerup", onUp, { passive: true });
                      }
                }
                isDragging={needsChainSwitch ? false : dragging}
                onClose={onClose}
                onMinimize={needsChainSwitch || isMobile ? undefined : onMinimize}
                onToggleFullscreen={
                  needsChainSwitch || isMobile ? undefined : onToggleFullscreen
                }
                isFullscreen={fullscreen}
                showClock={false}
              />

              <div className={clsx("flex flex-1 min-h-0 flex-col overflow-hidden", COINFACE_BACKDROP)}>
                <CoinFlipHeader
                  historyOpen={historyOpen}
                  toggleHistory={toggleHistory}
                  historyCount={history.length}
                  headsCount={headsCount}
                  tailsCount={tailsCount}
                  wins={wins}
                  losses={losses}
                  totalWagered={totalWagered}
                  totalWinningPayout={totalWinningPayout}
                  totalProfit={totalProfit}
                  formatEth={formatEth}
                />

                <main className="flex flex-1 min-h-0 flex-col gap-5 overflow-y-auto px-4 py-5 text-slate-100 overscroll-contain scrollbar-thin scrollbar-thumb-emerald-500/40 scrollbar-track-transparent sm:gap-6 sm:px-6 sm:py-6">
                  {historyOpen ? (
                    <CoinFlipHistory
                      history={history}
                      explorerBaseUrl={explorerBaseUrl}
                      formatTimeAgo={formatTimeAgo}
                      formatEth={formatEth}
                      formatMultiplier={formatMultiplier}
                      shortenHash={shortenHash}
                      verifyLoading={verifyLoading}
                      onVerify={handleVerifyHistoryEntry}
                    />
                  ) : (
                    <>
                      <CoinFlipVisualPanel
                        isFlipping={isFlipping}
                        coinFloatAnimation={coinFloatAnimation}
                        activeVariant={activeVariant}
                        userChoice={userChoice}
                        onSelectChoice={setUserChoice}
                        statusTone={statusTone}
                        statusMessage={statusMessage}
                        balanceDisplay={balanceDisplay}
                        targetChainLabel={targetChainLabel}
                        needsChainSwitch={needsChainSwitch}
                        onSwitchChain={handleNetworkSwitch}
                        isBalanceLoading={isBalanceLoading}
                        hasSufficientBalance={hasSufficientBalance}
                        betValid={betValid}
                        lastOutcome={lastOutcome}
                        roundSummary={roundSummary}
                        multiplierValid={multiplierValid}
                        onFlip={handleFlip}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <CoinFlipBetControls
                          betInput={betInput}
                          onBetInputChange={setBetInput}
                          onResetBet={() => setBetInput(MIN_BET.toFixed(3))}
                          betError={betError}
                          allowedPresetMultipliers={allowedPresetMultipliers}
                        />
                        <CoinFlipMultiplierControls
                          betValue={betValue}
                          isFlipping={isFlipping}
                          isCustomMultiplier={isCustomMultiplier}
                          setIsCustomMultiplier={setIsCustomMultiplier}
                          selectedMultiplier={selectedMultiplier}
                          setSelectedMultiplier={setSelectedMultiplier}
                          customMultiplierInput={customMultiplierInput}
                          setCustomMultiplierInput={setCustomMultiplierInput}
                          activeMultiplier={Number(activeMultiplier)}
                          formatMultiplier={formatMultiplier}
                          highestAllowedPreset={highestAllowedPreset}
                          multiplierError={multiplierError}
                          potentialPayout={potentialPayout}
                          formatEth={formatEth}
                        />
                      </div>
                    </>
                  )}
                </main>
              </div>
            </div>

            <CoinFlipOutcomePopup
              outcomePopup={outcomePopup}
              onClose={() => setOutcomePopup(null)}
              disabled={needsChainSwitch}
            />

            <CoinFlipNetworkGate
              visible={needsChainSwitch}
              targetChainLabel={targetChainLabel}
              onSwitchNetwork={handleNetworkSwitch}
            />
          </div>
        </div>
      </div>

      <CoinFlipVerifyModal
        open={showVerifyModal}
        verifyError={verifyError}
        revealInfo={revealInfo}
        verifySubject={verifySubject}
        onClose={handleVerifyModalClose}
      />
    </div>
  );
}
