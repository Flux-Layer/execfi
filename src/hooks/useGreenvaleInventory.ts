import { useCallback, useEffect, useMemo, useState } from "react";
import { usePublicClient } from "wagmi";
import {
  FARMING_CHAIN_ID,
  FARMING_CORE_ADDRESS,
  ITEM1155_ADDRESS,
} from "@/lib/contracts/addresses";

const TOOL_TOKEN_BASE = 100_000;
const SEED_TOKEN_BASE = 200_000;
const WATER_TOKEN_ID = 300_000;

const ERC1155_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const FARMING_CORE_ACTIVE_TOOL_ABI = [
  {
    type: "function",
    name: "activeTool",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type InventorySeedBalance = {
  seedType: number;
  tokenId: number;
  balance: bigint;
};

export type InventoryToolBalance = {
  rarity: number;
  tokenId: number;
  balance: bigint;
};

export type UseGreenvaleInventoryResult = {
  seeds: InventorySeedBalance[];
  tools: InventoryToolBalance[];
  water: { tokenId: number; balance: bigint };
  activeToolTokenId: bigint | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

const EMPTY_RESULT: UseGreenvaleInventoryResult = {
  seeds: [],
  tools: [],
  water: { tokenId: WATER_TOKEN_ID, balance: 0n },
  activeToolTokenId: null,
  isLoading: false,
  error: null,
  refetch: async () => {},
};

export default function useGreenvaleInventory(
  account: `0x${string}` | null,
  seedTypes: number[],
  toolRarities: number[],
): UseGreenvaleInventoryResult {
  const publicClient = usePublicClient({ chainId: FARMING_CHAIN_ID });
  const [state, setState] = useState<UseGreenvaleInventoryResult>(EMPTY_RESULT);

  const normalizedSeeds = useMemo(
    () =>
      Array.from(new Set(seedTypes))
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b),
    [seedTypes],
  );
  const normalizedTools = useMemo(
    () =>
      Array.from(new Set(toolRarities))
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b),
    [toolRarities],
  );

  const fetchInventory = useCallback(async () => {
    const item1155Address = ITEM1155_ADDRESS;
    if (!account || !publicClient || !item1155Address) {
      setState((prev) => (prev === EMPTY_RESULT ? prev : { ...EMPTY_RESULT, refetch: prev.refetch }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const contracts = [
        ...normalizedSeeds.map((seedType) => ({
          address: item1155Address,
          abi: ERC1155_BALANCE_ABI,
          functionName: "balanceOf" as const,
          args: [account, BigInt(SEED_TOKEN_BASE + seedType)],
        })),
        ...normalizedTools.map((rarity) => ({
          address: item1155Address,
          abi: ERC1155_BALANCE_ABI,
          functionName: "balanceOf" as const,
          args: [account, BigInt(TOOL_TOKEN_BASE + rarity)],
        })),
        {
          address: item1155Address,
          abi: ERC1155_BALANCE_ABI,
          functionName: "balanceOf" as const,
          args: [account, BigInt(WATER_TOKEN_ID)],
        },
      ];

      const multicallResults =
        await publicClient.multicall({
          contracts,
          allowFailure: true,
        });

      const seedBalances: InventorySeedBalance[] = normalizedSeeds.map(
        (seedType, index) => {
          const entry = multicallResults[index];
          const raw =
            entry && entry.status === "success" && entry.result !== undefined
              ? BigInt(entry.result as bigint)
              : 0n;
          return {
            seedType,
            tokenId: SEED_TOKEN_BASE + seedType,
            balance: raw,
          };
        },
      );
      const toolOffset = normalizedSeeds.length;
      const toolBalances: InventoryToolBalance[] = normalizedTools.map(
        (rarity, toolIndex) => {
          const entry = multicallResults[toolOffset + toolIndex];
          const raw =
            entry && entry.status === "success" && entry.result !== undefined
              ? BigInt(entry.result as bigint)
              : 0n;
          return {
            rarity,
            tokenId: TOOL_TOKEN_BASE + rarity,
            balance: raw,
          };
        },
      );

      const waterEntry =
        multicallResults[toolOffset + normalizedTools.length];
      const waterBalance =
        waterEntry && waterEntry.status === "success" && waterEntry.result !== undefined
          ? BigInt(waterEntry.result as bigint)
          : 0n;

      let activeToolTokenId: bigint | null = null;
      if (FARMING_CORE_ADDRESS) {
        try {
          const result = (await publicClient.readContract({
            address: FARMING_CORE_ADDRESS,
            abi: FARMING_CORE_ACTIVE_TOOL_ABI,
            functionName: "activeTool",
            args: [account],
          })) as bigint;
          activeToolTokenId = result === 0n ? null : result;
        } catch {
          activeToolTokenId = null;
        }
      }

      setState((prev) => ({
        ...prev,
        seeds: seedBalances,
        tools: toolBalances,
        water: { tokenId: WATER_TOKEN_ID, balance: waterBalance },
        activeToolTokenId,
        isLoading: false,
        error: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        seeds: [],
        tools: [],
        water: { tokenId: WATER_TOKEN_ID, balance: 0n },
        activeToolTokenId: null,
        isLoading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      }));
    }
  }, [
    account,
    normalizedSeeds,
    normalizedTools,
    publicClient,
  ]);

  useEffect(() => {
    void fetchInventory();
  }, [fetchInventory]);

  const refetch = useCallback(async () => {
    await fetchInventory();
  }, [fetchInventory]);

  return useMemo(
    () => ({
      ...state,
      refetch,
    }),
    [state, refetch],
  );
}
