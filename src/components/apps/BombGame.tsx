"use client";

import { useEffect, useMemo, useState } from "react";
import { useBalance } from "wagmi";
import { formatEther } from "viem";
import { useDock } from "@/context/DockContext";
import { useResponsive } from "@/hooks/useResponsive";
import { useEOA } from "@/providers/EOAProvider";
import useSmartWallet from "@/hooks/useSmartWallet";
import { useOnboarding } from "@/context/OnboardingContext";
import { TutorialModal } from "@/components/tutorial/TutorialModal";
import { BetControls } from "./bomb/BetControls";
import HowItWorksModal from "./bomb/HowItWorksModal";
import { BombBoardSection } from "./bomb/components/BombBoardSection";
import { BombFairnessPanel } from "./bomb/components/BombFairnessPanel";
import { GameOverBanner, GameOverModal } from "./bomb/components/BombGameOver";
import { BombTileCustomizerModal } from "./bomb/components/BombTileCustomizerModal";
import { BombWindowFrame } from "./bomb/components/BombWindowFrame";
import { BombTabNavigation } from "./bomb/components/BombTabNavigation";
import { BombHistoryTab } from "./bomb/components/BombHistoryTab";
import { BombStatsTab } from "./bomb/components/BombStatsTab";
import { BombVerificationModal } from "./bomb/components/BombVerificationModal";
import { useBombGameState } from "./bomb/useBombGameState";
import { DEGENSHOOT_CHAIN_ID } from "@/lib/contracts/addresses";

export default function BombGameWindow() {
  const {
    gameState: { open, minimized, fullscreen, version },
    closeGame,
    minimizeGame,
    toggleFullscreenGame,
  } = useDock();

  if (!open) return null;

  return (
    <BombGameContent
      key={version}
      minimized={minimized}
      fullscreen={fullscreen}
      onClose={closeGame}
      onMinimize={minimizeGame}
      onToggleFullscreen={toggleFullscreenGame}
    />
  );
}

type BombGameContentProps = {
  minimized: boolean;
  fullscreen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onToggleFullscreen: () => void;
};

function BombGameContent({
  minimized,
  fullscreen,
  onClose,
  onMinimize,
  onToggleFullscreen,
}: BombGameContentProps) {
  const { isMobile } = useResponsive();
  const { selectedWallet } = useEOA();
  const { smartAccountAddress } = useSmartWallet();
  const { showTutorial } = useOnboarding();

  const activeAddress = (selectedWallet?.address ??
    smartAccountAddress) as `0x${string}` | undefined;

  const game = useBombGameState({
    fullscreen,
    isMobile,
    wallet: selectedWallet ?? null,
    activeAddress,
  });

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<'game' | 'history' | 'stats'>('game');
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [verificationSessionId, setVerificationSessionId] = useState<string | null>(null);

  const {
    data: balanceData,
    isLoading: isBalanceLoading,
  } = useBalance({
    address: activeAddress,
    chainId: DEGENSHOOT_CHAIN_ID,
    query: {
      enabled: Boolean(activeAddress),
      refetchInterval: 15_000,
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line no-console
    console.log("[BombGame] Balance context", {
      activeAddress,
      isBalanceLoading,
      balanceData,
    });
  }, [activeAddress, balanceData, isBalanceLoading]);

  const balanceNumeric = useMemo(() => {
    if (!balanceData) return null;
    try {
      return Number(formatEther(balanceData.value));
    } catch {
      return null;
    }
  }, [balanceData]);

  const balanceDisplay = useMemo(() => {
    if (balanceNumeric === null || !Number.isFinite(balanceNumeric)) {
      return balanceData ? `${balanceData.formatted} ${balanceData.symbol}` : null;
    }
    const formatted = balanceNumeric.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: balanceNumeric < 1 ? 6 : 4,
    });
    return `${formatted} ${balanceData?.symbol ?? "ETH"}`;
  }, [balanceData, balanceNumeric]);

  const balanceSummary = useMemo(() => {
    const chainLabel = "Balance :";
    if (!activeAddress) {
      return {
        chainLabel,
        isLoading: false,
        valueLabel: null as string | null,
      };
    }

    return {
      chainLabel,
      isLoading: isBalanceLoading,
      valueLabel: balanceDisplay,
    };
  }, [activeAddress, balanceDisplay, isBalanceLoading]);

  const betAmountNumeric = useMemo(() => {
    const parsed = Number(game.betInput);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
    if (typeof game.betAmountValue === "number") {
      return game.betAmountValue;
    }
    return null;
  }, [game.betAmountValue, game.betInput]);

  const cashOutLabel = useMemo(() => {
    if (!game.cashOutAmount) return undefined;
    return `Cash Out (${game.cashOutAmount.toFixed(game.cashOutAmount < 1 ? 4 : 2)} ETH)`;
  }, [game.cashOutAmount]);

  if (minimized) return null;

  const disableCustomize =
    game.isBuildingRound ||
    !game.fairnessState ||
    game.isRoundInProgress ||
    game.isOnchainBusy ||
    !game.isWalletConnected ||
    game.needsChainSwitch ||
    game.isSessionStuck;
  const disableReroll =
    game.isBuildingRound ||
    !game.fairnessState ||
    game.isRoundInProgress ||
    game.isOnchainBusy ||
    !game.isWalletConnected ||
    game.needsChainSwitch ||
    game.isSessionStuck;

  return (
    <BombWindowFrame
      windowRef={game.windowRef}
      containerRef={game.containerRef}
      effectiveFullscreen={game.effectiveFullscreen}
      fullscreen={fullscreen}
      isMobile={isMobile}
      position={game.position}
      isReady={game.isReady}
      dragging={game.dragging}
      onClose={onClose}
      onMinimize={onMinimize}
      onToggleFullscreen={onToggleFullscreen}
      onHeaderDrag={game.handleHeaderDrag}
    >
      {/* Tutorial Modal - only renders when game is active and user needs onboarding */}
      {showTutorial && <TutorialModal />}

      <HowItWorksModal open={game.showInfo} onClose={game.closeInfo} />

      {/* Tab Navigation */}
      <BombTabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Game Tab */}
      {activeTab === 'game' && (
      <div className="flex h-full flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_center,#111827,#030712)]">
        <BombBoardSection
          rowsForRender={game.rowsForRender}
          rowRefs={game.rowRefs}
          rowStats={game.rowStats}
          activeRowIndex={game.activeRowIndex}
          hasStarted={game.hasStarted}
          status={game.status}
          onTileSelect={game.handleTileClick}
          summary={{
            title: game.summaryTitle,
            variant: game.summaryVariant,
            multiplier: game.currentMultiplier,
            potentialPayout: game.potentialPayout,
            hasStarted: game.hasStarted,
            betAmount: game.betAmount,
          }}
        />

      <BetControls
        betInput={game.betInput}
        betError={game.betError}
        onBetChange={game.updateBetInput}
        onQuickBet={game.quickBet}
        onStartRound={game.handleStartGame}
        onCashOut={game.handleCashOut}
        startDisabled={game.isStartDisabled}
        cashOutDisabled={!game.canCashOut || game.isOnchainBusy}
        startLabel={game.startLabel}
        cashOutLabel={cashOutLabel}
        onShowInfo={game.openInfo}
        onShowCustomizer={game.openCustomizer}
        onReroll={() => {
          void game.rerollTiles();
        }}
        onToggleSound={game.toggleSound}
        soundOn={game.soundOn}
        disableCustomize={disableCustomize}
        disableReroll={disableReroll}
        balanceLabel={balanceSummary.chainLabel}
        balanceValue={balanceSummary.valueLabel}
        balanceIsLoading={balanceSummary.isLoading}
        balanceNumericValue={balanceNumeric}
        betAmountValue={betAmountNumeric}
        startHelperText={game.startHelperText}
        showSwitchChain={game.needsChainSwitch}
        onSwitchChain={() => {
          void game.switchToGameChain();
        }}
        switchChainLabel={`Switch to ${game.targetChainLabel}`}
        switchChainDisabled={!game.needsChainSwitch || game.isOnchainBusy}
        showRestartButton={game.isSessionStuck}
        onRestart={() => {
          void game.restartStuckSession();
        }}
        restartLabel="Restart Game"
        restartDisabled={
          !game.isSessionStuck || game.isOnchainBusy || game.isBuildingRound
        }
      />

        <BombFairnessPanel
          status={game.status}
          isBuildingRound={game.isBuildingRound}
          isRevealing={game.isRevealing}
          rerollTiles={game.rerollTiles}
          revealFairness={game.revealFairness}
          verifyRound={game.verifyRound}
          isVerifying={game.isVerifying}
          fairnessState={game.fairnessState}
          rows={game.rows}
          rowStats={game.rowStats}
          roundSummary={game.roundSummary}
          canReveal={game.canReveal}
          verificationStatus={game.verificationStatus}
          verificationOutput={game.verificationOutput}
        />

        {game.status === "lost" && (
          <GameOverBanner
            lostRow={game.lostRow}
            onReplay={() => {
              void game.playAgain();
            }}
          />
        )}
      </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="h-full overflow-hidden bg-[radial-gradient(circle_at_center,#111827,#030712)]">
          <BombHistoryTab
            onVerifyClick={(sessionId) => {
              setVerificationSessionId(sessionId);
              setVerificationModalOpen(true);
            }}
            onDetailsClick={(sessionId) => {
              // Optional: Could open a details modal in the future
              console.log('Details for session:', sessionId);
            }}
          />
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="h-full overflow-hidden bg-[radial-gradient(circle_at_center,#111827,#030712)]">
          <BombStatsTab />
        </div>
      )}

      <BombTileCustomizerModal
        open={game.showCustomizer}
        pendingRange={game.pendingRange}
        adjustPendingRange={game.adjustPendingRange}
        projectedMaxMultiplier={game.projectedMaxMultiplier}
        onApply={game.applyTileRange}
        onUseDefault={game.useDefaultTileRange}
        onClose={game.closeCustomizer}
        isBuildingRound={game.isBuildingRound}
      />

      <GameOverModal
        open={game.status === "lost" && game.showGameOver}
        lostRow={game.lostRow}
        onReplay={() => {
          void game.playAgain();
        }}
        onClose={game.dismissGameOver}
      />

      {/* Verification Modal */}
      <BombVerificationModal
        sessionId={verificationSessionId || ''}
        isOpen={verificationModalOpen}
        onClose={() => {
          setVerificationModalOpen(false);
          setVerificationSessionId(null);
        }}
        onVerified={() => {
          // Modal closed, history will auto-refresh
        }}
      />
    </BombWindowFrame>
  );
}
