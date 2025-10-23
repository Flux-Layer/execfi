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

function parseBlockNumber(value: string | undefined): bigint | null {
  if (!value) return null;
  try {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = normalized.startsWith("0x") || normalized.startsWith("0X")
      ? BigInt(normalized)
      : BigInt(normalized);
    return parsed >= 0n ? parsed : null;
  } catch {
    return null;
  }
}

export const DEGENSHOOT_ADDRESS =
  normalizeAddress(process.env.NEXT_PUBLIC_DEGENSHOOT_ADDRESS);

export const WAGER_VAULT_ADDRESS =
  normalizeAddress(process.env.NEXT_PUBLIC_WAGER_VAULT_ADDRESS);

export const COINFLIP_ADDRESS =
  normalizeAddress(process.env.NEXT_PUBLIC_COINFLIP_ADDRESS);

export const COINFLIP_VAULT_ADDRESS =
  normalizeAddress(process.env.NEXT_PUBLIC_COINFLIP_VAULT_ADDRESS);

export const XP_REGISTRY_ADDRESS =
  normalizeAddress(process.env.NEXT_PUBLIC_XP_REGISTRY_PROXY);

export const DEGENSHOOT_CHAIN_ID = parseChainId(
  process.env.NEXT_PUBLIC_DEGENSHOOT_CHAIN_ID,
  84532,
);

export const COINFLIP_CHAIN_ID = parseChainId(
  process.env.NEXT_PUBLIC_COINFLIP_CHAIN_ID,
  84532,
);

export const DEGENSHOOT_GAME_ID =
  Number(process.env.NEXT_PUBLIC_DEGENSHOOT_GAME_ID ?? process.env.GAME_ID ?? 1);

export const COINFLIP_GAME_ID = Number(
  process.env.NEXT_PUBLIC_COINFLIP_GAME_ID ??
    process.env.COINFLIP_GAME_ID ??
    4,
);

export const ONCHAIN_FEATURES_ENABLED =
  Boolean(DEGENSHOOT_ADDRESS && WAGER_VAULT_ADDRESS && XP_REGISTRY_ADDRESS);

export const COINFLIP_FEATURES_ENABLED =
  Boolean(COINFLIP_ADDRESS && COINFLIP_VAULT_ADDRESS && XP_REGISTRY_ADDRESS);

export const PARAMETER_REGISTRY_ADDRESS = normalizeAddress(
  process.env.NEXT_PUBLIC_PARAMETER_REGISTRY_ADDRESS,
);

export const FARMING_CORE_ADDRESS = normalizeAddress(
  process.env.NEXT_PUBLIC_FARMING_CORE_ADDRESS,
);

export const FARMING_GAME_ID = Number(
  process.env.NEXT_PUBLIC_FARMING_GAME_ID ??
    process.env.FARMING_GAME_ID ??
    2,
);

export const MALLWARE_GAME_ID = Number(
  process.env.NEXT_PUBLIC_MALLWARE_GAME_ID ?? process.env.MALLWARE_GAME_ID ?? 99,
);

export const FARMING_CHAIN_ID = parseChainId(
  process.env.NEXT_PUBLIC_FARMING_CHAIN_ID,
  84532,
);

export const ITEM1155_ADDRESS = normalizeAddress(
  process.env.NEXT_PUBLIC_ITEM1155_ADDRESS,
);

export const LAND721_ADDRESS = normalizeAddress(
  process.env.NEXT_PUBLIC_LAND721_ADDRESS,
);

export const SHOP_ADDRESS = normalizeAddress(
  process.env.NEXT_PUBLIC_SHOP_ADDRESS,
);

export const MARKETPLACE_ADDRESS = normalizeAddress(
  process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS,
);

export const MARKETPLACE_DEPLOYMENT_BLOCK = parseBlockNumber(
  process.env.NEXT_PUBLIC_MARKETPLACE_DEPLOYMENT_BLOCK ??
    process.env.MARKETPLACE_DEPLOYMENT_BLOCK,
);

export const MARKETPLACE_LOOKBACK_BLOCKS = parseBlockNumber(
  process.env.NEXT_PUBLIC_MARKETPLACE_LOOKBACK_BLOCKS ??
    process.env.MARKETPLACE_LOOKBACK_BLOCKS,
);
