import { NextResponse } from "next/server";
import { base, baseSepolia } from "viem/chains";
import {
  createPublicClient,
  http,
  getAddress,
  isAddress,
} from "viem";

import {
  FARMING_CORE_ADDRESS,
  PARAMETER_REGISTRY_ADDRESS,
  XP_REGISTRY_ADDRESS,
  FARMING_CHAIN_ID,
  FARMING_GAME_ID,
} from "@/lib/contracts/addresses";
import {
  XP_REGISTRY_ABI,
  xpRegistryPublicClient,
  XP_DOMAIN,
  getXpSignerAccount,
} from "@/lib/contracts/xpRegistry";

const XP_TYPES = {
  XPAdd: [
    { name: "user", type: "address" },
    { name: "gameId", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

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
    name: "seasonBonusBps",
    inputs: [],
    outputs: [{ type: "uint16" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxPlotsPerHarvest",
    inputs: [],
    outputs: [{ type: "uint16" }],
    stateMutability: "view",
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
        ],
        type: "tuple",
      },
    ],
  },
] as const;

const FARMING_CHAIN =
  FARMING_CHAIN_ID === base.id ? base : baseSepolia;

const RPC_URL =
  process.env.RPC_URL_BASE_SEPOLIA ??
  FARMING_CHAIN.rpcUrls?.default?.http?.[0] ??
  "https://base-sepolia.g.alchemy.com/v2/demo";

const farmingClient = createPublicClient({
  chain: FARMING_CHAIN,
  transport: http(RPC_URL),
});

type PlotInfo = {
  owner: `0x${string}`;
  seedCount: number;
  toolRarity: number;
  seedTypes: readonly number[];
  plantedAt: bigint;
  readyAt: bigint;
  harvested: boolean;
};

const MAX_SEEDS_PER_PLOT = 5;
const TEN_THOUSAND = 10_000n;

export async function POST(request: Request) {
  try {
    if (
      !FARMING_CORE_ADDRESS ||
      !PARAMETER_REGISTRY_ADDRESS ||
      !XP_REGISTRY_ADDRESS
    ) {
      return NextResponse.json(
        { success: false, error: "CONFIG_NOT_SET" },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { user, landIds, deadline } = body ?? {};

    if (
      !user ||
      !isAddress(user) ||
      !Array.isArray(landIds) ||
      landIds.length === 0
    ) {
      return NextResponse.json(
        { success: false, error: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    const normalizedUser = getAddress(user);
    const uniqueLandIds = [...new Set(landIds)].map((id) => {
      const parsed = Number(id);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error("INVALID_LAND_ID");
      }
      return BigInt(parsed);
    });

    const [maxPlotsPerHarvest, seasonBonusBps] = await Promise.all([
      farmingClient.readContract({
        address: PARAMETER_REGISTRY_ADDRESS,
        abi: PARAMETER_REGISTRY_ABI,
        functionName: "maxPlotsPerHarvest",
      }),
      farmingClient.readContract({
        address: PARAMETER_REGISTRY_ADDRESS,
        abi: PARAMETER_REGISTRY_ABI,
        functionName: "seasonBonusBps",
      }),
    ]);

    if (uniqueLandIds.length > Number(maxPlotsPerHarvest)) {
      return NextResponse.json(
        { success: false, error: "HARVEST_LIMIT_EXCEEDED" },
        { status: 409 },
      );
    }

    const seedConfigCache = new Map<number, { baseExp: number; growthSeconds: number }>();
    const now = BigInt(Math.floor(Date.now() / 1000));
    let totalExp = 0n;

    const plotSummaries = [];

    for (const landId of uniqueLandIds) {
      const rawPlot = await farmingClient.readContract({
        address: FARMING_CORE_ADDRESS,
        abi: FARMING_CORE_ABI,
        functionName: "getPlot",
        args: [landId],
      });

      const plot: PlotInfo = {
        owner: (rawPlot as any).owner ?? (rawPlot as any)[0],
        seedCount: Number((rawPlot as any).seedCount ?? (rawPlot as any)[1]),
        toolRarity: Number((rawPlot as any).toolRarity ?? (rawPlot as any)[2]),
        seedTypes: (
          ((rawPlot as any).seedTypes ?? (rawPlot as any)[3]) as readonly (
            number | bigint
          )[]
        ).map((value) => Number(value)),
        plantedAt: BigInt(
          (rawPlot as any).plantedAt ?? (rawPlot as any)[4] ?? 0,
        ),
        readyAt: BigInt(
          (rawPlot as any).readyAt ?? (rawPlot as any)[5] ?? 0,
        ),
        harvested: Boolean(
          (rawPlot as any).harvested ?? (rawPlot as any)[6] ?? false,
        ),
      };

      if (plot.owner.toLowerCase() !== normalizedUser.toLowerCase()) {
        return NextResponse.json(
          { success: false, error: "NOT_LAND_OWNER", landId: landId.toString() },
          { status: 403 },
        );
      }

      const seedCount = Number(plot.seedCount);
      if (seedCount === 0 || seedCount > MAX_SEEDS_PER_PLOT) {
        return NextResponse.json(
          { success: false, error: "PLOT_EMPTY", landId: landId.toString() },
          { status: 409 },
        );
      }

      if (plot.harvested) {
        return NextResponse.json(
          { success: false, error: "PLOT_ALREADY_HARVESTED", landId: landId.toString() },
          { status: 409 },
        );
      }

      if (now < plot.readyAt) {
        return NextResponse.json(
          { success: false, error: "PLOT_NOT_READY", landId: landId.toString(), readyAt: plot.readyAt.toString() },
          { status: 409 },
        );
      }

      const seedTypes: number[] = [];
      let plotExp = 0n;

      for (let i = 0; i < seedCount; i += 1) {
        const seedType = plot.seedTypes[i];
        if (!Number.isFinite(seedType) || seedType < 0) {
          return NextResponse.json(
            { success: false, error: "INVALID_SEED_TYPE", landId: landId.toString() },
            { status: 400 },
          );
        }

        seedTypes.push(seedType);

        if (!seedConfigCache.has(seedType)) {
          const config = (await farmingClient.readContract({
            address: PARAMETER_REGISTRY_ADDRESS,
            abi: PARAMETER_REGISTRY_ABI,
            functionName: "getSeedConfig",
            args: [BigInt(seedType)],
          })) as readonly [number | bigint, number | bigint];
          const [baseExp, growthSeconds] = config;
          seedConfigCache.set(seedType, {
            baseExp: Number(baseExp),
            growthSeconds: Number(growthSeconds),
          });
        }

        const cfg = seedConfigCache.get(seedType)!;
        const base = BigInt(cfg.baseExp);
        const bonusExp =
          (base * (TEN_THOUSAND + BigInt(seasonBonusBps))) / TEN_THOUSAND;
        plotExp += bonusExp;
      }

      totalExp += plotExp;
      plotSummaries.push({
        landId: landId.toString(),
        seedTypes,
        exp: plotExp.toString(),
        readyAt: plot.readyAt.toString(),
      });
    }

    if (totalExp === 0n) {
      return NextResponse.json(
        { success: false, error: "ZERO_EXP" },
        { status: 400 },
      );
    }

    const nonce = await xpRegistryPublicClient.readContract({
      address: XP_REGISTRY_ADDRESS,
      abi: XP_REGISTRY_ABI,
      functionName: "getNonce",
      args: [normalizedUser, BigInt(FARMING_GAME_ID)],
    });

    const finalDeadline =
      BigInt(deadline ?? Math.floor(Date.now() / 1000) + 600);

    const account = getXpSignerAccount();
    const signature = await account.signTypedData({
      domain: XP_DOMAIN,
      primaryType: "XPAdd",
      types: XP_TYPES,
      message: {
        user: normalizedUser,
        gameId: BigInt(FARMING_GAME_ID),
        amount: totalExp,
        nonce,
        deadline: finalDeadline,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        amount: totalExp.toString(),
        deadline: finalDeadline.toString(),
        nonce: nonce.toString(),
        signature,
        plots: plotSummaries,
      },
    });
  } catch (error) {
    console.error("[farming/sign-xp]", error);
    const message =
      error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
