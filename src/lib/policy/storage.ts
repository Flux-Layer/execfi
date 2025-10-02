// Policy persistence service using localStorage

import type { PolicyState, PolicyPreset } from "./types";
import { POLICY_PRESETS } from "./presets";

const POLICY_STORAGE_KEY = "execfi:policy";
const POLICY_VERSION = "1.0.0";

export function loadPolicy(): PolicyState | null {
  try {
    const stored = localStorage.getItem(POLICY_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as PolicyState;

    // Version migration if needed
    if (parsed.metadata.version !== POLICY_VERSION) {
      console.warn("Policy version mismatch, using defaults");
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Failed to load policy:", error);
    return null;
  }
}

export function savePolicy(policy: PolicyState): void {
  try {
    localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(policy));
  } catch (error) {
    console.error("Failed to save policy:", error);
  }
}

export function clearPolicy(): void {
  localStorage.removeItem(POLICY_STORAGE_KEY);
}

export function createDefaultPolicy(preset: PolicyPreset = "moderate"): PolicyState {
  return {
    config: { ...POLICY_PRESETS[preset] },
    metadata: {
      preset,
      lastModified: Date.now(),
      version: POLICY_VERSION,
    },
    dailySpent: 0,
    dailyTxCount: 0,
    hourlyTxCount: 0,
    lastResetDate: new Date().toISOString().split('T')[0],
    lastResetHour: new Date().getHours(),
  };
}
