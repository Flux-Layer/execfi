import { useCallback, useMemo } from "react";
import { zeroAddress } from "viem";
import { useReadContract } from "wagmi";
import { XP_REGISTRY_ABI, XP_REGISTRY_CHAIN } from "@/lib/contracts/xpRegistry";
import {
  COINFLIP_GAME_ID,
  DEGENSHOOT_GAME_ID,
  MALLWARE_GAME_ID,
  XP_REGISTRY_ADDRESS,
} from "@/lib/contracts/addresses";

type UseUserXpOptions = {
  address?: `0x${string}` | null;
  gameId?: number;
};

type GameXpBreakdownItem = {
  key: string;
  id: number;
  label: string;
  xp: bigint | null;
  formatted: string | null;
};

type UseUserXpResult = {
  enabled: boolean;
  hasRegistry: boolean;
  gameXp: bigint | null;
  totalXp: bigint | null;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  gameBreakdown: GameXpBreakdownItem[];
  formatted: {
    game: string | null;
    total: string | null;
    breakdown: Array<{
      key: string;
      label: string;
      value: string | null;
    }>;
  };
};

const formatBigInt = (value: bigint | null): string | null => {
  if (value === null) return null;
  try {
    if (value > 0n && value > BigInt(Number.MAX_SAFE_INTEGER)) {
      return value.toString();
    }
    return Number(value).toLocaleString();
  } catch {
    return value.toString();
  }
};

export function useUserXp(options: UseUserXpOptions = {}): UseUserXpResult {
  const { address, gameId = DEGENSHOOT_GAME_ID } = options;
  const account = address ?? null;
  const contractAddress = XP_REGISTRY_ADDRESS;
  const enabled = Boolean(account && contractAddress);
  const chainId = XP_REGISTRY_CHAIN.id;

  const degenshootXpQuery = useReadContract({
    abi: XP_REGISTRY_ABI,
    address: contractAddress ?? zeroAddress,
    functionName: "xp",
    args: [account ?? zeroAddress, BigInt(gameId)],
    chainId,
    query: {
      enabled,
      staleTime: 15_000,
      refetchInterval: enabled ? 15_000 : undefined,
      refetchOnWindowFocus: false,
    },
  });

  const coinflipXpQuery = useReadContract({
    abi: XP_REGISTRY_ABI,
    address: contractAddress ?? zeroAddress,
    functionName: "xp",
    args: [account ?? zeroAddress, BigInt(COINFLIP_GAME_ID)],
    chainId,
    query: {
      enabled,
      staleTime: 15_000,
      refetchInterval: enabled ? 15_000 : undefined,
      refetchOnWindowFocus: false,
    },
  });

  const mallwareXpQuery = useReadContract({
    abi: XP_REGISTRY_ABI,
    address: contractAddress ?? zeroAddress,
    functionName: "xp",
    args: [account ?? zeroAddress, BigInt(MALLWARE_GAME_ID)],
    chainId,
    query: {
      enabled,
      staleTime: 15_000,
      refetchInterval: enabled ? 15_000 : undefined,
      refetchOnWindowFocus: false,
    },
  });

  const totalQuery = useReadContract({
    abi: XP_REGISTRY_ABI,
    address: contractAddress ?? zeroAddress,
    functionName: "totalXP",
    args: [account ?? zeroAddress],
    chainId,
    query: {
      enabled,
      staleTime: 15_000,
      refetchInterval: enabled ? 15_000 : undefined,
      refetchOnWindowFocus: false,
    },
  });

  const refetch = useCallback(async () => {
    await Promise.all([
      degenshootXpQuery.refetch(),
      coinflipXpQuery.refetch(),
      mallwareXpQuery.refetch(),
      totalQuery.refetch(),
    ]);
  }, [coinflipXpQuery, degenshootXpQuery, mallwareXpQuery, totalQuery]);

  const breakdown = useMemo<GameXpBreakdownItem[]>(
    () => [
      {
        key: "degenshoot",
        id: DEGENSHOOT_GAME_ID,
        label: "Degenshoot",
        xp: degenshootXpQuery.data ?? null,
        formatted: formatBigInt(degenshootXpQuery.data ?? null),
      },
      {
        key: "coinflip",
        id: COINFLIP_GAME_ID,
        label: "CoinFlip",
        xp: coinflipXpQuery.data ?? null,
        formatted: formatBigInt(coinflipXpQuery.data ?? null),
      },
      {
        key: "mallware",
        id: MALLWARE_GAME_ID,
        label: "Mallware",
        xp: mallwareXpQuery.data ?? null,
        formatted: formatBigInt(mallwareXpQuery.data ?? null),
      },
    ],
    [coinflipXpQuery.data, degenshootXpQuery.data, mallwareXpQuery.data],
  );

  const formatted = useMemo(
    () => ({
      game: formatBigInt(degenshootXpQuery.data ?? null),
      total: formatBigInt(totalQuery.data ?? null),
      breakdown: breakdown.map((item) => ({
        key: item.key,
        label: item.label,
        value: item.formatted,
      })),
    }),
    [breakdown, degenshootXpQuery.data, totalQuery.data],
  );

  const queries = [degenshootXpQuery, coinflipXpQuery, mallwareXpQuery, totalQuery];
  const firstError =
    degenshootXpQuery.error ?? coinflipXpQuery.error ?? mallwareXpQuery.error ?? totalQuery.error ?? null;

  return {
    enabled,
    hasRegistry: Boolean(contractAddress),
    gameXp: degenshootXpQuery.data ?? null,
    totalXp: totalQuery.data ?? null,
    isLoading: queries.some((query) => query.isLoading),
    isFetching: queries.some((query) => query.isFetching),
    isError: Boolean(firstError),
    error: firstError,
    refetch,
    gameBreakdown: breakdown,
    formatted,
  };
}

export default useUserXp;
