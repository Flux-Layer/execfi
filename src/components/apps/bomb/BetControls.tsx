"use client";

import { memo } from "react";
import { FiInfo, FiSliders, FiVolume2, FiVolumeX, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { CHIP_BUTTON_CLASS, CONTROL_BUTTON_CLASS, MIN_BET_AMOUNT, QUICK_BETS } from "./config";

type BetControlsProps = {
  betInput: string;
  betError: string | null;
  onBetChange: (value: string) => void;
  onQuickBet: (value: number) => void;
  onStartRound: () => void;
  onCashOut: () => void;
  startDisabled: boolean;
  cashOutDisabled: boolean;
  startLabel: string;
  cashOutLabel?: string;
  onShowInfo: () => void;
  onShowCustomizer: () => void;
  onReroll: () => void;
  onToggleSound: () => void;
  soundOn: boolean;
  disableCustomize: boolean;
  disableReroll: boolean;
  balanceLabel?: string;
  balanceValue?: string | null;
  balanceIsLoading?: boolean;
  balanceNumericValue?: number | null;
  betAmountValue?: number | null;
  startHelperText?: string | null;
  showSwitchChain?: boolean;
  onSwitchChain?: () => void;
  switchChainLabel?: string;
  switchChainDisabled?: boolean;
  showRestartButton?: boolean;
  onRestart?: () => void;
  restartLabel?: string;
  restartDisabled?: boolean;
  // New props for collapsible functionality
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
};

function BetControlsComponent({
  betInput,
  betError,
  onBetChange,
  onQuickBet,
  onStartRound,
  onCashOut,
  startDisabled,
  cashOutDisabled,
  startLabel,
  cashOutLabel,
  onShowInfo,
  onShowCustomizer,
  onReroll,
  onToggleSound,
  soundOn,
  disableCustomize,
  disableReroll,
  balanceLabel,
  balanceValue,
  balanceIsLoading,
  balanceNumericValue,
  betAmountValue,
  startHelperText,
  showSwitchChain,
  onSwitchChain,
  switchChainLabel,
  switchChainDisabled,
  showRestartButton,
  onRestart,
  restartLabel,
  restartDisabled,
  isCollapsed = false,
  onToggleCollapse,
}: BetControlsProps) {
  const insufficientBalance =
    typeof balanceNumericValue === "number" &&
    typeof betAmountValue === "number" &&
    balanceNumericValue < betAmountValue;

  // Compact view when collapsed (mobile only)
  if (isCollapsed) {
    return (
      <div className="flex flex-col gap-2 border-t border-slate-900/60 bg-slate-950/80 px-2 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-1 gap-2">
            <button
              type="button"
              onClick={onCashOut}
              disabled={cashOutDisabled || insufficientBalance || balanceIsLoading}
              className={`flex-1 rounded-full border px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                cashOutDisabled
                  ? "border-slate-700 bg-slate-900/80 text-slate-400"
                  : "border-amber-500 bg-amber-500/20 text-amber-200 hover:border-amber-400 hover:text-amber-100"
              }`}
            >
              {cashOutLabel ?? "Cash Out"}
            </button>
            <button
              type="button"
              onClick={onStartRound}
              disabled={startDisabled || insufficientBalance || balanceIsLoading}
              className={`flex-1 rounded-full border px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                insufficientBalance
                  ? "border-red-500 bg-red-500/20 text-red-200"
                  : startDisabled
                  ? "border-slate-700 bg-slate-900/80 text-slate-400"
                  : "border-emerald-500 bg-emerald-500/20 text-emerald-200 hover:border-emerald-400 hover:text-emerald-100"
              }`}
            >
              {insufficientBalance
                ? "Low Balance"
                : balanceIsLoading
                ? "Loading..."
                : startLabel}
            </button>
          </div>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded-lg border border-slate-700 bg-slate-900/80 p-2 text-slate-400 transition hover:border-slate-600 hover:text-slate-300"
              aria-label="Expand controls"
            >
              <FiChevronUp className="text-base" />
            </button>
          )}
        </div>
        {balanceLabel && (
          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
            <span>{balanceLabel}</span>
            <span className="font-mono text-slate-300">
              {balanceIsLoading ? "..." : balanceValue ?? "—"}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4 border-t border-slate-900/60 bg-slate-950/80 px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5">
      {balanceLabel && (
        <div className="flex flex-col gap-1 rounded-xl sm:rounded-2xl border border-slate-800/60 bg-slate-900/70 px-3 py-2 sm:px-4 sm:py-3 text-xs font-medium text-slate-200 shadow-inner shadow-black/30 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-400">{balanceLabel}</span>
          <span className="font-mono text-sm sm:text-base text-slate-100">
            {balanceIsLoading ? "Fetching..." : balanceValue ?? "—"}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:gap-5 rounded-xl sm:rounded-2xl border border-slate-900/60 bg-slate-950/60 p-3 sm:p-4 md:p-5 text-[11px] text-slate-300">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <label className="flex w-full flex-col gap-2 text-[11px] uppercase tracking-wide text-slate-400 sm:max-w-xs">
            <span>Bet amount (ETH)</span>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.]?[0-9]*"
              value={betInput}
              onChange={(event) => onBetChange(event.target.value)}
              placeholder={MIN_BET_AMOUNT.toFixed(3)}
              className="w-full rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 font-mono text-sm text-slate-100 outline-none transition focus:border-emerald-400"
            />
          </label>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={onCashOut}
              disabled={cashOutDisabled || insufficientBalance || balanceIsLoading}
              className={`w-full rounded-full border px-5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
                cashOutDisabled
                  ? "border-slate-700 bg-slate-900/80 text-slate-400"
                  : "border-amber-500 bg-amber-500/20 text-amber-200 hover:border-amber-400 hover:text-amber-100"
              }`}
            >
              {cashOutLabel ?? "Cash Out"}
            </button>
            <button
              type="button"
              onClick={onStartRound}
              disabled={startDisabled || insufficientBalance || balanceIsLoading}
              className={`w-full rounded-full border px-5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
                insufficientBalance
                  ? "border-red-500 bg-red-500/20 text-red-200"
                  : startDisabled
                  ? "border-slate-700 bg-slate-900/80 text-slate-400"
                  : "border-emerald-500 bg-emerald-500/20 text-emerald-200 hover:border-emerald-400 hover:text-emerald-100"
              }`}
            >
              {insufficientBalance
                ? "Insufficient balance"
                : balanceIsLoading
                ? "Checking balance..."
                : startLabel}
            </button>
            {showSwitchChain && (
              <button
                type="button"
                onClick={onSwitchChain}
                disabled={switchChainDisabled}
                className="w-full rounded-full border border-sky-500 bg-sky-500/20 px-5 py-2 text-xs font-semibold text-sky-200 transition hover:border-sky-400 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {switchChainLabel ?? "Switch Chain"}
              </button>
            )}
            {showRestartButton && (
              <button
                type="button"
                onClick={onRestart}
                disabled={restartDisabled}
                className="w-full rounded-full border border-amber-500 bg-amber-500/10 px-5 py-2 text-xs font-semibold text-amber-200 transition hover:border-amber-400 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {restartLabel ?? "Restart Game"}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_BETS.map((bet) => (
            <button
              type="button"
              key={`quick-bet-${bet}`}
              onClick={() => onQuickBet(bet)}
              className={`${CHIP_BUTTON_CLASS} ${parseFloat(betInput) === bet ? "border-emerald-400 text-emerald-200" : ""}`}
            >
              {bet.toFixed(3)}
            </button>
          ))}
        </div>

        {(betError || insufficientBalance || startHelperText) && (
          <div className="space-y-1 text-[10px]">
            {betError && <p className="text-red-400">{betError}</p>}
            {insufficientBalance && (
              <p className="text-red-400">Insufficient balance. Adjust your bet or top up.</p>
            )}
            {startHelperText && <p className="text-amber-300">{startHelperText}</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2 flex-1">
            <button
              type="button"
              onClick={onShowInfo}
              className={`${CONTROL_BUTTON_CLASS} flex-1 min-w-[140px] sm:flex-none`}
            >
              <FiInfo className="text-sm" />
              How It Works
            </button>
            <button
              type="button"
              onClick={onShowCustomizer}
              disabled={disableCustomize}
              className={`${CONTROL_BUTTON_CLASS} flex-1 min-w-[140px] disabled:opacity-60 sm:flex-none`}
            >
              <FiSliders className="text-sm" />
              Customize Tiles
            </button>
            <button
              type="button"
              onClick={onReroll}
              disabled={disableReroll}
              className={`${CONTROL_BUTTON_CLASS} flex-1 min-w-[140px] disabled:opacity-60 sm:flex-none`}
            >
              Reroll Layout
            </button>
            <button
              type="button"
              onClick={onToggleSound}
              className={`${CONTROL_BUTTON_CLASS} flex-1 min-w-[140px] sm:flex-none`}
            >
              {soundOn ? (
                <>
                  <FiVolume2 className="text-sm" />
                  Sounds on
                </>
              ) : (
                <>
                  <FiVolumeX className="text-sm" />
                  Sounds off
                </>
              )}
            </button>
          </div>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="md:hidden rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-400 transition hover:border-slate-600 hover:text-slate-300 flex items-center gap-1"
              aria-label="Collapse controls"
            >
              <FiChevronDown className="text-sm" />
              <span>Minimize</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const BetControls = memo(BetControlsComponent);
