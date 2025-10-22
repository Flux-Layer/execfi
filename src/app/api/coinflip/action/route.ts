import { NextResponse } from "next/server";
import {
  keccak256,
  encodeAbiParameters,
  parseEventLogs,
  type Hex,
  getAddress,
} from "viem";
import { Prisma } from "@prisma/client";
import {
  getSessionRecord,
  updateSessionRecord,
  pruneExpiredSessions,
} from "../sessionStore";
import {
  COINFLIP_ADDRESS,
  COINFLIP_CHAIN_ID,
  COINFLIP_GAME_ID,
  COINFLIP_VAULT_ADDRESS,
} from "@/lib/contracts/addresses";
import {
  deriveAllowedMultipliers,
  normalizeCoinSide,
  requiredBetForMultiplier,
} from "@/lib/games/coinflip/config";
import { deriveOutcome } from "@/lib/games/coinflip/fairness";
import { coinFlipVaultPublicClient, COINFLIP_VAULT_ABI } from "@/lib/contracts/coinFlipVault";
import { prisma } from "@/lib/db/client";

type RegisterRequest = {
  sessionId: string;
  action: "registerWager";
  wagerWei: string;
  address: string;
  txHash?: string;
};

type FlipRequest = {
  sessionId: string;
  action: "flip";
  guess: string;
  multiplier: number;
  address: string;
};

type ActionRequest = RegisterRequest | FlipRequest;

const XP_WIN = 250;
const XP_LOSS = 100;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<ActionRequest>;
    await pruneExpiredSessions();

    if (!body || typeof body.sessionId !== "string" || !body.sessionId.trim()) {
      return NextResponse.json(
        { success: false, error: "INVALID_SESSION_ID" },
        { status: 400 },
      );
    }

    if (typeof body.action !== "string") {
      return NextResponse.json(
        { success: false, error: "ACTION_REQUIRED" },
        { status: 400 },
      );
    }

    const session = await getSessionRecord(body.sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "SESSION_NOT_FOUND" },
        { status: 404 },
      );
    }

    if (session.status === "submitted") {
      return NextResponse.json(
        { success: false, error: "SESSION_ALREADY_SUBMITTED" },
        { status: 409 },
      );
    }

    switch (body.action) {
      case "registerWager":
        return await handleRegisterWager(session.id, body as RegisterRequest);
      case "flip":
        return await handleFlip(session.id, body as FlipRequest);
      default:
        return NextResponse.json(
          { success: false, error: "UNKNOWN_ACTION" },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("[API] /coinflip/action failed:", error);
    return NextResponse.json(
      { success: false, error: "ACTION_FAILED" },
      { status: 500 },
    );
  }
}

async function handleRegisterWager(
  sessionId: string,
  body: RegisterRequest,
) {
  if (!COINFLIP_VAULT_ADDRESS || !COINFLIP_ADDRESS) {
    return NextResponse.json(
      { success: false, error: "ONCHAIN_UNAVAILABLE" },
      { status: 503 },
    );
  }

  if (typeof body.address !== "string") {
    return NextResponse.json(
      { success: false, error: "ADDRESS_REQUIRED" },
      { status: 400 },
    );
  }

  let normalizedAddress: `0x${string}`;
  try {
    normalizedAddress = getAddress(body.address);
  } catch {
    return NextResponse.json(
      { success: false, error: "INVALID_ADDRESS" },
      { status: 400 },
    );
  }

  if (typeof body.wagerWei !== "string") {
    return NextResponse.json(
      { success: false, error: "INVALID_WAGER" },
      { status: 400 },
    );
  }

  let wagerValue: bigint;
  try {
    wagerValue = BigInt(body.wagerWei);
    if (wagerValue <= 0n) {
      throw new Error("Wager must be positive");
    }
  } catch {
    return NextResponse.json(
      { success: false, error: "INVALID_WAGER" },
      { status: 400 },
    );
  }

  const session = await getSessionRecord(sessionId);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "SESSION_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (session.userAddress && session.userAddress.toLowerCase() !== normalizedAddress.toLowerCase()) {
    return NextResponse.json(
      { success: false, error: "UNAUTHORIZED" },
      { status: 403 },
    );
  }

  if (session.wagerWei && session.wagerWei === body.wagerWei) {
    return NextResponse.json({
      success: true,
      sessionId,
      wagerWei: session.wagerWei,
      chainId: COINFLIP_CHAIN_ID,
    });
  }

  const sessionNumericId = BigInt(sessionId);
  const sessionKey = keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "uint256" },
        { type: "uint64" },
      ],
      [normalizedAddress, BigInt(COINFLIP_GAME_ID), sessionNumericId],
    ),
  );

  let escrowAmount: bigint;
  try {
    escrowAmount = await coinFlipVaultPublicClient.readContract({
      address: COINFLIP_VAULT_ADDRESS,
      abi: COINFLIP_VAULT_ABI,
      functionName: "escrow",
      args: [sessionKey],
    }) as bigint;
  } catch (error) {
    console.error("[CoinFlip] Failed to read escrow:", error);
    return NextResponse.json(
      { success: false, error: "WAGER_VERIFICATION_FAILED" },
      { status: 502 },
    );
  }

  if (escrowAmount === 0n || escrowAmount !== wagerValue) {
    const txHash =
      typeof body.txHash === "string" && body.txHash.startsWith("0x")
        ? (body.txHash as Hex)
        : null;

    if (!txHash) {
      return NextResponse.json(
        { success: false, error: "WAGER_NOT_FOUND_ONCHAIN" },
        { status: 409 },
      );
    }

    let receipt: Awaited<
      ReturnType<typeof coinFlipVaultPublicClient.waitForTransactionReceipt>
    >;
    try {
      receipt = await coinFlipVaultPublicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 30_000,
        pollingInterval: 1_500,
      });
    } catch (error) {
      console.warn("[CoinFlip] Receipt wait failed:", error);
      return NextResponse.json(
        { success: false, error: "WAGER_CONFIRMATION_PENDING" },
        { status: 409 },
      );
    }

    if (receipt.status !== "success") {
      return NextResponse.json(
        { success: false, error: "WAGER_VERIFICATION_FAILED" },
        { status: 502 },
      );
    }

    type BetPlacedLog = {
      eventName: "BetPlaced";
      args: {
        bettor: `0x${string}`;
        sessionKey: `0x${string}`;
        amount: bigint;
      };
    };

    const logs = parseEventLogs({
      abi: COINFLIP_VAULT_ABI,
      eventName: "BetPlaced",
      logs: receipt.logs,
    }) as unknown as BetPlacedLog[];

    const matchedLog = logs.find((log) => {
      const bettor = log.args.bettor?.toLowerCase() ?? "";
      return (
        bettor === normalizedAddress.toLowerCase() &&
        log.args.sessionKey === sessionKey
      );
    });

    if (!matchedLog) {
      return NextResponse.json(
        { success: false, error: "BET_EVENT_NOT_FOUND" },
        { status: 409 },
      );
    }

    const escrowAtBlock = await coinFlipVaultPublicClient.readContract({
      address: COINFLIP_VAULT_ADDRESS,
      abi: COINFLIP_VAULT_ABI,
      functionName: "escrow",
      args: [sessionKey],
      blockNumber: receipt.blockNumber,
    });

    if (escrowAtBlock !== wagerValue) {
      return NextResponse.json(
        { success: false, error: "WAGER_MISMATCH_ONCHAIN" },
        { status: 409 },
      );
    }
  }

  await updateSessionRecord(sessionId, {
    userAddress: normalizedAddress.toLowerCase() as `0x${string}`,
    wagerWei: body.wagerWei,
    status: "wagerRegistered",
  });

  return NextResponse.json({
    success: true,
    sessionId,
    wagerWei: body.wagerWei,
    chainId: COINFLIP_CHAIN_ID,
  });
}

async function handleFlip(sessionId: string, body: FlipRequest) {
  if (typeof body.address !== "string") {
    return NextResponse.json(
      { success: false, error: "ADDRESS_REQUIRED" },
      { status: 400 },
    );
  }

  let normalizedAddress: `0x${string}`;
  try {
    normalizedAddress = getAddress(body.address);
  } catch {
    return NextResponse.json(
      { success: false, error: "INVALID_ADDRESS" },
      { status: 400 },
    );
  }

  if (typeof body.multiplier !== "number" || !Number.isFinite(body.multiplier)) {
    return NextResponse.json(
      { success: false, error: "INVALID_MULTIPLIER" },
      { status: 400 },
    );
  }

  const session = await getSessionRecord(sessionId);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "SESSION_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (!session.userAddress || session.userAddress.toLowerCase() !== normalizedAddress.toLowerCase()) {
    return NextResponse.json(
      { success: false, error: "UNAUTHORIZED" },
      { status: 403 },
    );
  }

  if (!session.wagerWei) {
    return NextResponse.json(
      { success: false, error: "WAGER_NOT_REGISTERED" },
      { status: 409 },
    );
  }

  const guess = normalizeCoinSide(body.guess);
  if (!guess) {
    return NextResponse.json(
      { success: false, error: "INVALID_GUESS" },
      { status: 400 },
    );
  }

  const wagerValue = Number(BigInt(session.wagerWei) / 10n ** 15n) / 1000; // convert to ETH with limited precision
  const allowedMultipliers = deriveAllowedMultipliers(wagerValue);
  if (!allowedMultipliers.includes(body.multiplier)) {
    return NextResponse.json(
      { success: false, error: "MULTIPLIER_NOT_ALLOWED" },
      { status: 400 },
    );
  }

  const { outcome, randomValue } = deriveOutcome(session.serverSeed, session.clientSeed);
  const correct = outcome === guess;
  const selectedMultiplierX100 = Math.round(body.multiplier * 100);
  const payoutMultiplierX100 = correct ? selectedMultiplierX100 : 0;
  const xp = correct ? XP_WIN : XP_LOSS;

  const summary = {
    guess,
    outcome,
    correct,
    multiplierX100: payoutMultiplierX100,
    xp,
    wagerWei: session.wagerWei,
    randomValue,
    timestamp: Date.now(),
  };

  await updateSessionRecord(sessionId, {
    status: "flipped",
    guess,
    outcome,
    multiplierX100: payoutMultiplierX100,
    xp,
    roundSummary: summary,
    finalizedAt: Date.now(),
  });

  const baseHistoryData: Prisma.CoinFlipHistoryCreateInput = {
    userAddress: session.userAddress ?? normalizedAddress.toLowerCase(),
    sessionId,
    guess,
    outcome,
    wagerWei: session.wagerWei ?? "0",
    selectedMultiplier: selectedMultiplierX100,
    payoutMultiplier: payoutMultiplierX100,
    xp,
    payoutTxHash: null,
  };

  const randomValueForDb =
    typeof randomValue === "number" ? randomValue : null;

  const seedMetadata: Pick<
    Prisma.CoinFlipHistoryCreateInput,
    "serverSeed" | "clientSeed" | "serverSeedHash" | "randomValue" | "revealedAt"
  > = {
    serverSeed: session.serverSeed,
    clientSeed: session.clientSeed,
    serverSeedHash: session.serverSeedHash,
    randomValue: randomValueForDb,
    revealedAt: new Date(),
  };

  const fullHistoryData: Prisma.CoinFlipHistoryCreateInput = {
    ...baseHistoryData,
    ...seedMetadata,
  };

  const seedUpdateData: Prisma.CoinFlipHistoryUpdateInput = {
    serverSeed: seedMetadata.serverSeed,
    clientSeed: seedMetadata.clientSeed,
    serverSeedHash: seedMetadata.serverSeedHash,
    randomValue: seedMetadata.randomValue,
    revealedAt: seedMetadata.revealedAt,
  };

  let createdHistoryId: number | null = null;
  let seedsPersisted = false;

  try {
    const created = await prisma.coinFlipHistory.create({
      data: fullHistoryData,
    });
    createdHistoryId = created.id;
    seedsPersisted = true;
  } catch (error) {
    const isSchemaMismatch =
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2022") ||
      error instanceof Prisma.PrismaClientValidationError;

    if (!isSchemaMismatch) {
      console.error("[CoinFlip] history insert failed:", error);
    }

    if (!seedsPersisted) {
      try {
        const created = await prisma.coinFlipHistory.create({
          data: baseHistoryData,
        });
        createdHistoryId = created.id;
      } catch (fallbackError) {
        console.error("[CoinFlip] history insert fallback failed:", fallbackError);
      }
    }
  }

  if (createdHistoryId !== null && !seedsPersisted) {
    try {
      await prisma.coinFlipHistory.update({
        where: { id: createdHistoryId },
        data: seedUpdateData,
      });
    } catch (error) {
      const isSchemaMismatch =
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2022") ||
        error instanceof Prisma.PrismaClientValidationError;

      if (!isSchemaMismatch) {
        console.error("[CoinFlip] history detail update failed:", error);
      }
    }
  }

  const requiredBet = requiredBetForMultiplier(body.multiplier);

  return NextResponse.json({
    success: true,
    sessionId,
    result: outcome,
    guess,
    correct,
    multiplierX100: payoutMultiplierX100,
    selectedMultiplierX100,
    xp,
    randomValue,
    status: "flipped",
    serverSeedHash: session.serverSeedHash,
    clientSeed: session.clientSeed,
    requiredBet,
  });
}
