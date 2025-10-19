import { useCallback, useEffect, useMemo, useState } from "react";
import { type Hex, encodePacked, keccak256 } from "viem";
import { usePublicClient } from "wagmi";

import {
  FARMING_CHAIN_ID,
  PARAMETER_REGISTRY_ADDRESS,
} from "@/lib/contracts/addresses";

const PARAMETER_REGISTRY_ABI = [
  {
    type: "function",
    name: "getSeedConfig",
    stateMutability: "view",
    inputs: [{ name: "seedType", type: "uint256" }],
    outputs: [
      { name: "baseExp", type: "uint32" },
      { name: "growthSeconds", type: "uint32" },
    ],
  },
  {
    type: "function",
    name: "getShopItemConfig",
    stateMutability: "view",
    inputs: [{ name: "itemKey", type: "bytes32" }],
    outputs: [
      {
        components: [
          { name: "price", type: "uint128" },
          { name: "active", type: "bool" },
        ],
        type: "tuple",
      },
    ],
  },
  {
    type: "function",
    name: "getToolSpeedBps",
    stateMutability: "view",
    inputs: [{ name: "toolRarity", type: "uint256" }],
    outputs: [{ type: "uint16" }],
  },
  {
    type: "function",
    name: "seasonBonusBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint16" }],
  },
  {
    type: "function",
    name: "maxPlotsPerHarvest",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint16" }],
  },
  {
    type: "function",
    name: "xpRateLimitPerTx",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

const SEED_TYPES = [100, 101, 102] as const;
const TOOL_RARITIES = [1, 2, 3] as const;

const SHOP_WATER_KEY = keccak256(encodePacked(["string"], ["SHOP_WATER"]));
const SHOP_LAND_KEY = keccak256(encodePacked(["string"], ["SHOP_LAND"]));

const seedItemKey = (seedType: number): Hex =>
  keccak256(
    encodePacked(["string", "uint256"], ["SHOP_SEED", BigInt(seedType)]),
  );

const toolItemKey = (rarity: number): Hex =>
  keccak256(
    encodePacked(["string", "uint256"], ["SHOP_TOOL", BigInt(rarity)]),
  );

export type GreenvaleSeedConfig = {
  seedType: number;
  baseExp: number;
  growthSeconds: number;
  priceWei: bigint;
  active: boolean;
};

export type GreenvaleToolConfig = {
  rarity: number;
  speedBps: number;
  priceWei: bigint;
  speedMultiplier: number;
  active: boolean;
};

export type GreenvaleGlobalConfig = {
  maxPlotsPerHarvest: number | null;
  xpRateLimitPerTx: bigint | null;
  seasonBonusBps: number | null;
};

export type UseGreenvaleConfigResult = {
  seeds: GreenvaleSeedConfig[];
  tools: GreenvaleToolConfig[];
  waterPriceWei: bigint | null;
  waterActive: boolean;
  landPriceWei: bigint | null;
  landActive: boolean;
  global: GreenvaleGlobalConfig;
  isLoading: boolean;
  error: Error | null;
  hasRegistry: boolean;
  refetch: () => Promise<void>;
};

type InternalState = {
  seeds: GreenvaleSeedConfig[];
  tools: GreenvaleToolConfig[];
  waterPriceWei: bigint | null;
  waterActive: boolean;
  landPriceWei: bigint | null;
  landActive: boolean;
  global: GreenvaleGlobalConfig;
};

const INITIAL_STATE: InternalState = {
  seeds: [],
  tools: [],
  waterPriceWei: null,
  waterActive: false,
  landPriceWei: null,
  landActive: false,
  global: {
    maxPlotsPerHarvest: null,
    xpRateLimitPerTx: null,
    seasonBonusBps: null,
  },
};

export function useGreenvaleConfig(): UseGreenvaleConfigResult {
  const parameterRegistry = PARAMETER_REGISTRY_ADDRESS;
  const hasRegistry = Boolean(parameterRegistry);

  const publicClient = usePublicClient({
    chainId: FARMING_CHAIN_ID,
  });

  const [state, setState] = useState<InternalState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState<boolean>(hasRegistry);
  const [error, setError] = useState<Error | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!parameterRegistry) {
      throw new Error("PARAMETER_REGISTRY_NOT_CONFIGURED");
    }
    if (!publicClient) {
      throw new Error("NO_PUBLIC_CLIENT");
    }

    const seedConfigCalls = SEED_TYPES.map((seedType) => ({
      address: parameterRegistry,
      abi: PARAMETER_REGISTRY_ABI,
      functionName: "getSeedConfig" as const,
      args: [BigInt(seedType)],
    }));

    const seedShopCalls = SEED_TYPES.map((seedType) => ({
      address: parameterRegistry,
      abi: PARAMETER_REGISTRY_ABI,
      functionName: "getShopItemConfig" as const,
      args: [seedItemKey(seedType)],
    }));

    const toolSpeedCalls = TOOL_RARITIES.map((rarity) => ({
      address: parameterRegistry,
      abi: PARAMETER_REGISTRY_ABI,
      functionName: "getToolSpeedBps" as const,
      args: [BigInt(rarity)],
    }));

    const toolShopCalls = TOOL_RARITIES.map((rarity) => ({
      address: parameterRegistry,
      abi: PARAMETER_REGISTRY_ABI,
      functionName: "getShopItemConfig" as const,
      args: [toolItemKey(rarity)],
    }));

    const globalCalls = [
      {
        address: parameterRegistry,
        abi: PARAMETER_REGISTRY_ABI,
        functionName: "getShopItemConfig" as const,
        args: [SHOP_WATER_KEY],
      },
      {
        address: parameterRegistry,
        abi: PARAMETER_REGISTRY_ABI,
        functionName: "getShopItemConfig" as const,
        args: [SHOP_LAND_KEY],
      },
      {
        address: parameterRegistry,
        abi: PARAMETER_REGISTRY_ABI,
        functionName: "seasonBonusBps" as const,
        args: [],
      },
      {
        address: parameterRegistry,
        abi: PARAMETER_REGISTRY_ABI,
        functionName: "maxPlotsPerHarvest" as const,
        args: [],
      },
      {
        address: parameterRegistry,
        abi: PARAMETER_REGISTRY_ABI,
        functionName: "xpRateLimitPerTx" as const,
        args: [],
      },
    ] as const;

    const contracts = [
      ...seedConfigCalls,
      ...seedShopCalls,
      ...toolSpeedCalls,
      ...toolShopCalls,
      ...globalCalls,
    ] as const;

    const results = await publicClient.multicall({
      contracts,
      allowFailure: false,
    });

    let cursor = 0;
    const take = <T>(
      count: number,
      mapper: (value: unknown, index: number) => T,
    ): T[] => {
      const slice = results.slice(cursor, cursor + count);
      cursor += count;
      return slice.map((entry, index) =>
        mapper((entry as { result?: unknown }).result ?? entry, index),
      );
    };

    const seedConfigResults = take(seedConfigCalls.length, (item) => {
      const [baseExp, growthSeconds] = item as readonly [
        number | bigint,
        number | bigint,
      ];
      return {
        baseExp: Number(baseExp),
        growthSeconds: Number(growthSeconds),
      };
    });

    const seedShopResults = take(seedShopCalls.length, (item) => {
      const { price, active } = item as { price: bigint; active: boolean };
      return { price, active };
    });

    const toolSpeedResults = take(toolSpeedCalls.length, (item) => {
      const value = item as bigint | number;
      return Number(value);
    });

    const toolShopResults = take(toolShopCalls.length, (item) => {
      const { price, active } = item as { price: bigint; active: boolean };
      return { price, active };
    });

    const globalResults = take(globalCalls.length, (item) => item as unknown);

    const waterResult = globalResults[0] as
      | { price: bigint; active: boolean }
      | undefined;
    const landResult = globalResults[1] as
      | { price: bigint; active: boolean }
      | undefined;
    const seasonResult = globalResults[2] as bigint | number;
    const maxPlotsResult = globalResults[3] as bigint | number;
    const xpResult = globalResults[4] as bigint;

    const seeds: GreenvaleSeedConfig[] = seedConfigResults.map(
      (cfg, index) => {
        const shop = seedShopResults[index] ?? { price: 0n, active: false };
        return {
          seedType: SEED_TYPES[index],
          baseExp: cfg.baseExp,
          growthSeconds: cfg.growthSeconds,
          priceWei: shop.price,
          active: shop.active,
        };
      },
    );

    const tools: GreenvaleToolConfig[] = toolSpeedResults.map(
      (speedBps, index) => {
        const shop = toolShopResults[index] ?? { price: 0n, active: false };
        return {
          rarity: TOOL_RARITIES[index],
          speedBps,
          priceWei: shop.price,
          speedMultiplier: 1 + speedBps / 10_000,
          active: shop.active,
        };
      },
    );

    const waterPriceWei = waterResult?.price ?? null;
    const waterActive = waterResult?.active ?? false;
    const landPriceWei = landResult?.price ?? null;
    const landActive = landResult?.active ?? false;

    const seasonBonusBps =
      seasonResult !== undefined ? Number(seasonResult) : null;
    const maxPlotsPerHarvest =
      maxPlotsResult !== undefined ? Number(maxPlotsResult) : null;
    const xpRateLimitPerTx = xpResult ?? null;

    return {
      seeds,
      tools,
      waterPriceWei,
      waterActive,
      landPriceWei,
      landActive,
      global: {
        seasonBonusBps,
        maxPlotsPerHarvest,
        xpRateLimitPerTx,
      },
    } satisfies InternalState;
  }, [parameterRegistry, publicClient]);

  const refetch = useCallback(async () => {
    const data = await fetchConfig();
    setState(data);
  }, [fetchConfig]);

  useEffect(() => {
    if (!hasRegistry || !publicClient) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchConfig()
      .then((data) => {
        if (!cancelled) {
          setState(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchConfig, hasRegistry, publicClient]);

  return useMemo(
    () => ({
      ...state,
      hasRegistry,
      isLoading,
      error,
      refetch,
    }),
    [error, hasRegistry, isLoading, refetch, state],
  );
}

export default useGreenvaleConfig;
