import { getAddress } from "viem";

function normalizeAddress(value: string | undefined): `0x${string}` | null {
  if (!value) return null;
  try {
    return getAddress(value as `0x${string}`);
  } catch {
    return null;
  }
}

function parseChainId(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const DEGENSHOOT_ADDRESS =
  normalizeAddress(process.env.NEXT_PUBLIC_DEGENSHOOT_ADDRESS);

export const WAGER_VAULT_ADDRESS =
  normalizeAddress(process.env.NEXT_PUBLIC_WAGER_VAULT_ADDRESS);

export const XP_REGISTRY_ADDRESS =
  normalizeAddress(process.env.NEXT_PUBLIC_XP_REGISTRY_PROXY);

export const DEGENSHOOT_CHAIN_ID = parseChainId(
  process.env.NEXT_PUBLIC_DEGENSHOOT_CHAIN_ID,
  84532,
);

export const DEGENSHOOT_GAME_ID =
  Number(process.env.NEXT_PUBLIC_DEGENSHOOT_GAME_ID ?? process.env.GAME_ID ?? 1);

export const ONCHAIN_FEATURES_ENABLED =
  Boolean(DEGENSHOOT_ADDRESS && WAGER_VAULT_ADDRESS && XP_REGISTRY_ADDRESS);
