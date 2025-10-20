import { useCallback, useMemo } from "react";
import { zeroAddress } from "viem";
import { useReadContract } from "wagmi";
import { XP_REGISTRY_ABI, XP_REGISTRY_CHAIN } from "@/lib/contracts/xpRegistry";
import { DEGENSHOOT_GAME_ID, XP_REGISTRY_ADDRESS } from "@/lib/contracts/addresses";

type UseUserXpOptions = {
  address?: `0x${string}` | null;
  gameId?: number;
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
  formatted: {
    game: string | null;
    total: string | null;
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

  const xpQuery = useReadContract({
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
    await Promise.all([xpQuery.refetch(), totalQuery.refetch()]);
  }, [totalQuery, xpQuery]);

  const formatted = useMemo(
    () => ({
      game: formatBigInt(xpQuery.data ?? null),
      total: formatBigInt(totalQuery.data ?? null),
    }),
    [xpQuery.data, totalQuery.data],
  );

  return {
    enabled,
    hasRegistry: Boolean(contractAddress),
    gameXp: xpQuery.data ?? null,
    totalXp: totalQuery.data ?? null,
    isLoading: xpQuery.isLoading || totalQuery.isLoading,
    isFetching: xpQuery.isFetching || totalQuery.isFetching,
    isError: Boolean(xpQuery.error ?? totalQuery.error),
    error: (xpQuery.error ?? totalQuery.error) ?? null,
    refetch,
    formatted,
  };
}

export default useUserXp;
