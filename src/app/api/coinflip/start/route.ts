import { NextResponse } from "next/server";
import { getAddress } from "viem";
import {
  createSessionRecord,
  pruneExpiredSessions,
} from "../sessionStore";
import {
  generateClientSeed,
  generateServerSeed,
  hashSeed,
} from "@/lib/games/coinflip/fairness";
import {
  COINFLIP_ADDRESS,
  COINFLIP_CHAIN_ID,
  COINFLIP_VAULT_ADDRESS,
} from "@/lib/contracts/addresses";
import { MIN_BET, PRESET_MULTIPLIERS } from "@/lib/games/coinflip/config";

type StartRequest = {
  address?: string;
  clientSeed?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as StartRequest;
    await pruneExpiredSessions();

    if (!body?.address) {
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

    const serverSeed = generateServerSeed();
    const serverSeedHash = hashSeed(serverSeed);
    const clientSeed =
      typeof body.clientSeed === "string" && body.clientSeed.trim().length > 0
        ? body.clientSeed.trim()
        : generateClientSeed();

    const session = await createSessionRecord({
      userAddress: normalizedAddress.toLowerCase() as `0x${string}`,
      serverSeed,
      serverSeedHash,
      clientSeed,
      status: "ready",
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      serverSeedHash: session.serverSeedHash,
      clientSeed: session.clientSeed,
      contractAddress: COINFLIP_ADDRESS,
      vaultAddress: COINFLIP_VAULT_ADDRESS,
      chainId: COINFLIP_CHAIN_ID,
      minBet: MIN_BET,
      presetMultipliers: PRESET_MULTIPLIERS,
    });
  } catch (error) {
    console.error("[API] /coinflip/start failed:", error);
    return NextResponse.json(
      { success: false, error: "FAILED_TO_CREATE_SESSION" },
      { status: 500 },
    );
  }
}
