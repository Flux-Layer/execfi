"use client";

import { useDock } from "@/context/DockContext";
import { useResponsive } from "@/hooks/useResponsive";
import { BetControls } from "./bomb/BetControls";
import HowItWorksModal from "./bomb/HowItWorksModal";
import { BombBoardSection } from "./bomb/components/BombBoardSection";
import { BombFairnessPanel } from "./bomb/components/BombFairnessPanel";
import { GameOverBanner, GameOverModal } from "./bomb/components/BombGameOver";
import { BombTileCustomizerModal } from "./bomb/components/BombTileCustomizerModal";
import { BombWindowFrame } from "./bomb/components/BombWindowFrame";
import { useBombGameState } from "./bomb/useBombGameState";

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
  const game = useBombGameState({ fullscreen, isMobile });

  if (minimized) return null;

  const disableCustomize = game.isBuildingRound || !game.fairnessState;
  const disableReroll = game.isBuildingRound || !game.fairnessState;

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
      <HowItWorksModal open={game.showInfo} onClose={game.closeInfo} />

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
            carryIn: game.carryInForPanel,
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
          startDisabled={game.isStartDisabled}
          startLabel={game.startLabel}
          onShowInfo={game.openInfo}
          onShowCustomizer={game.openCustomizer}
          onReroll={() => {
            void game.rerollTiles();
          }}
          onToggleSound={game.toggleSound}
          soundOn={game.soundOn}
          disableCustomize={disableCustomize}
          disableReroll={disableReroll}
        />

        <BombFairnessPanel
          status={game.status}
          isBuildingRound={game.isBuildingRound}
          rerollTiles={game.rerollTiles}
          txHashInput={game.txHashInput}
          setTxHashInput={game.setTxHashInput}
          txHashVerified={game.txHashVerified}
          revealFairness={game.revealFairness}
          verifyRound={game.verifyRound}
          isVerifying={game.isVerifying}
          fairnessState={game.fairnessState}
          rows={game.rows}
          rowStats={game.rowStats}
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
    </BombWindowFrame>
  );
}
