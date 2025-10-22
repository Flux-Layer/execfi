export const MIN_BET = 0.001;
export const BASE_MULTIPLIER = 2;
export const PRESET_MULTIPLIERS = [2, 5, 10, 15] as const;

export type CoinFlipSide = "Heads" | "Tails";

export function requiredBetForMultiplier(multiplier: number) {
  if (multiplier <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return (multiplier / BASE_MULTIPLIER) * MIN_BET;
}

export function deriveAllowedMultipliers(bet: number) {
  if (!Number.isFinite(bet) || bet < MIN_BET) {
    return [] as number[];
  }
  return PRESET_MULTIPLIERS.filter(
    (multiplier) => bet >= requiredBetForMultiplier(multiplier),
  );
}

export function normalizeCoinSide(value: string | null | undefined): CoinFlipSide | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "heads") return "Heads";
  if (normalized === "tails") return "Tails";
  return null;
}
