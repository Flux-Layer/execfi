import {
  BOMBS_PER_ROW,
  HOUSE_EDGE,
  MAX_GENERATED_ROWS,
  MAX_ROWS,
  MAX_TILE_OPTION,
  MAX_TOTAL_MULTIPLIER,
  MIN_TILE_OPTION,
  SESSION_KEY,
  TOTAL_COLUMNS,
} from "./config";
import type { StoredSession } from "./types";
import { calculateRowMultiplier } from "@/lib/games/bomb/fairness";

export function formatMultiplier(value: number | null | undefined): string {
  const numeric = value ?? 0;
  if (!Number.isFinite(numeric)) return "x0.00";
  return `x${numeric.toFixed(2)}`;
}

export function formatMultiplierOrDash(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return formatMultiplier(value);
}

export function formatPlain(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(digits);
}

function resolveSessionKey(address?: string | null) {
  if (!address) return SESSION_KEY;
  return `${SESSION_KEY}:${address.toLowerCase()}`;
}

export function loadStoredSession(address?: string | null): StoredSession | null {
  if (typeof window === "undefined") return null;
  const keysToTry = address
    ? [resolveSessionKey(address), SESSION_KEY]
    : [SESSION_KEY];
  for (const key of keysToTry) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as StoredSession;
      if (!parsed || typeof parsed !== "object") continue;
      if (address && key !== resolveSessionKey(address)) {
        window.localStorage.setItem(resolveSessionKey(address), raw);
        window.localStorage.removeItem(key);
      }
      return parsed;
    } catch (error) {
      console.warn("[BombGame] Failed to parse stored session", error);
    }
  }
  return null;
}

export function saveStoredSession(session: StoredSession | null, address?: string | null) {
  if (typeof window === "undefined") return;
  const key = resolveSessionKey(address);
  if (!session) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(session));
}

export function centerColumns(count: number): number[] {
  const remaining = TOTAL_COLUMNS - count;
  const padStart = Math.floor(remaining / 2);
  return Array.from({ length: count }, (_, idx) => padStart + idx);
}

export function clampTileValue(value: number): number {
  return Math.min(Math.max(value, MIN_TILE_OPTION), MAX_TILE_OPTION);
}

export function computeDynamicRowCount(tileRange: { min: number; max: number }): number {
  const worstRowMultiplier = calculateRowMultiplier(tileRange.max, BOMBS_PER_ROW, HOUSE_EDGE);
  let dynamicRowCount = MAX_ROWS;
  if (worstRowMultiplier > 1.0001) {
    const estimated = Math.ceil(Math.log(MAX_TOTAL_MULTIPLIER) / Math.log(worstRowMultiplier));
    if (Number.isFinite(estimated) && estimated > dynamicRowCount) {
      dynamicRowCount = Math.min(MAX_GENERATED_ROWS, estimated + 5);
    }
  }
  return dynamicRowCount;
}

export const DEFAULT_TILE_RANGE = { min: MIN_TILE_OPTION, max: MAX_TILE_OPTION } as const;
