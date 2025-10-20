import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { zeroAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import {
  FARMING_CHAIN_ID,
  FARMING_CORE_ADDRESS,
  LAND721_ADDRESS,
} from "@/lib/contracts/addresses";

const ERC721_ENUM_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenOfOwnerByIndex",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const FARMING_CORE_ABI = [
  {
    type: "function",
    name: "getPlot",
    stateMutability: "view",
    inputs: [{ name: "landId", type: "uint256" }],
    outputs: [
      {
        components: [
          { name: "owner", type: "address" },
          { name: "seedCount", type: "uint8" },
          { name: "toolRarity", type: "uint8" },
          { name: "seedTypes", type: "uint32[5]" },
          { name: "plantedAt", type: "uint64" },
          { name: "readyAt", type: "uint64" },
          { name: "harvested", type: "bool" },
          { name: "dug", type: "bool" },
        ],
        type: "tuple",
      },
    ],
  },
] as const;

export type GreenvalePlot = {
  landId: number;
  owner: `0x${string}`;
  seedCount: number;
  toolRarity: number;
  seedTypes: number[];
  plantedAt: bigint;
  readyAt: bigint;
  harvested: boolean;
  dug: boolean;
  isReady: boolean;
  isGrowing: boolean;
  isEmpty: boolean;
};

type UseGreenvalePlotsResult = {
  plots: GreenvalePlot[];
  readyPlotIds: number[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

const EMPTY_RESULT: UseGreenvalePlotsResult = {
  plots: [],
  readyPlotIds: [],
  isLoading: false,
  error: null,
  refetch: async () => {},
};

export default function useGreenvalePlots(
  accountOverride?: `0x${string}` | null,
): UseGreenvalePlotsResult {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: FARMING_CHAIN_ID });

  const activeAddress = (accountOverride ?? address) as
    | `0x${string}`
    | undefined;

  const [plots, setPlots] = useState<GreenvalePlot[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPlots = useCallback(async () => {
    if (
      !activeAddress ||
      !publicClient ||
      !LAND721_ADDRESS
    ) {
      setPlots([]);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const balance = (await publicClient.readContract({
        address: LAND721_ADDRESS,
        abi: ERC721_ENUM_ABI,
        functionName: "balanceOf",
        args: [activeAddress],
      })) as bigint;

      const count = Number(balance);
      if (!Number.isFinite(count) || count === 0) {
        setPlots([]);
        return;
      }

      // TypeScript refinement: LAND721_ADDRESS is checked above, so it's not null here
      const landAddress = LAND721_ADDRESS as `0x${string}`;

      const tokenCalls = Array.from({ length: count }, (_, index) => ({
        address: landAddress,
        abi: ERC721_ENUM_ABI,
        functionName: "tokenOfOwnerByIndex" as const,
        args: [activeAddress, BigInt(index)],
      }));

      const tokenResults = await publicClient.multicall({
        contracts: tokenCalls,
        allowFailure: false,
      });

      // When allowFailure is false, results are returned directly (not wrapped in .result)
      const landIds = tokenResults.map((result) => Number(result));

      let plotTuples: Array<
        readonly [
          `0x${string}`,
          bigint,
          bigint,
          readonly (number | bigint)[],
          bigint,
          bigint,
          boolean,
          boolean,
        ]
      > = [];

      if (FARMING_CORE_ADDRESS) {
        // TypeScript refinement: FARMING_CORE_ADDRESS is checked above, so it's not null here
        const farmingAddress = FARMING_CORE_ADDRESS as `0x${string}`;

        const plotCalls = landIds.map((landId) => ({
          address: farmingAddress,
          abi: FARMING_CORE_ABI,
          functionName: "getPlot" as const,
          args: [BigInt(landId)],
        }));

        const plotResults = await publicClient.multicall({
          contracts: plotCalls,
          allowFailure: false,
        });

        // When allowFailure is false, results are returned directly (not wrapped in .result)
        // The result is an object with named fields, convert to tuple
        plotTuples = plotResults.map((item) => {
          if (!item) {
            return [
              zeroAddress,
              0n,
              0n,
              [0, 0, 0, 0, 0] as const,
              0n,
              0n,
              false,
              false,
            ] as const;
          }
          return [
            item.owner,
            BigInt(item.seedCount),
            BigInt(item.toolRarity),
            item.seedTypes,
            item.plantedAt,
            item.readyAt,
            item.harvested,
            item.dug,
          ] as const;
        });
      } else {
        plotTuples = landIds.map(
          () =>
            ([
              activeAddress ?? zeroAddress,
              0n,
              0n,
              [0, 0, 0, 0, 0] as const,
              0n,
              0n,
              false,
              false,
            ] as const),
        );
      }

      const now = BigInt(Math.floor(Date.now() / 1000));
      const computedPlots: GreenvalePlot[] = plotTuples.map((tuple, index) => {
        const [
          owner,
          seedCountRaw,
          toolRarityRaw,
          seedTypesRaw,
          plantedAt,
          readyAt,
          harvested,
          dug,
        ] = tuple;

        const seedCount = Number(seedCountRaw);
        const toolRarity = Number(toolRarityRaw);
        const seedTypes = Array.from(seedTypesRaw).map((value) => Number(value));

        const activeSeeds = seedTypes.filter((value) => value !== 0);
        const isReady =
          !harvested && activeSeeds.length > 0 && readyAt !== 0n && readyAt <= now;
        const isGrowing = activeSeeds.length > 0 && !isReady && !harvested;
        const isEmpty = activeSeeds.length === 0;

        return {
          landId: landIds[index],
          owner,
          seedCount,
          toolRarity,
          seedTypes: activeSeeds,
          plantedAt,
          readyAt,
          harvested,
          dug,
          isReady,
          isGrowing,
          isEmpty,
        };
      });

      setPlots(computedPlots);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setPlots([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeAddress, publicClient]);

  useEffect(() => {
    fetchPlots();
  }, [fetchPlots, activeAddress]);

  const readyPlotIds = useMemo(
    () => plots.filter((plot) => plot.isReady).map((plot) => plot.landId),
    [plots],
  );

  return useMemo(
    () => ({
      plots,
      readyPlotIds,
      isLoading,
      error,
      refetch: fetchPlots,
    }),
    [fetchPlots, isLoading, plots, readyPlotIds, error],
  );
}
