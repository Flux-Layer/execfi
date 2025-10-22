import { NextResponse } from "next/server";
import { base, baseSepolia } from "viem/chains";
import { createPublicClient, http } from "viem";
import {
  getSessionRecord,
  updateSessionRecord,
  removeSessionRecord,
  pruneExpiredSessions,
} from "../sessionStore";
import {
  COINFLIP_ADDRESS,
  COINFLIP_CHAIN_ID,
  COINFLIP_GAME_ID,
  XP_REGISTRY_ADDRESS,
} from "@/lib/contracts/addresses";
import {
  COINFLIP_DOMAIN,
  COINFLIP_GAME_ID_BIGINT,
  getCoinFlipSignerAccount,
} from "@/lib/contracts/coinflip";
import { XP_REGISTRY_ABI } from "@/lib/contracts/xpRegistry";
import { mapOutcomeToEnum } from "@/lib/games/coinflip/fairness";

const RESULT_TYPES = {
  Result: [
    { name: "user", type: "address" },
    { name: "gameId", type: "uint256" },
    { name: "sessionId", type: "uint64" },
    { name: "guess", type: "uint8" },
    { name: "outcome", type: "uint8" },
    { name: "wager", type: "uint256" },
    { name: "multiplierX100", type: "uint256" },
    { name: "xp", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

const XP_TYPES = {
  XPAdd: [
    { name: "user", type: "address" },
    { name: "gameId", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

const XP_DOMAIN = {
  name: "XPRegistry",
  version: "1",
  chainId: COINFLIP_CHAIN_ID,
  verifyingContract: (XP_REGISTRY_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await pruneExpiredSessions();

    const { sessionId, user, wagerWei, deadline, xpDeadline } = body ?? {};

    if (
      !sessionId ||
      !user ||
      !wagerWei ||
      !COINFLIP_ADDRESS ||
      !XP_REGISTRY_ADDRESS
    ) {
      return NextResponse.json(
        { success: false, error: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    const session = await getSessionRecord(String(sessionId));
    if (!session) {
      return NextResponse.json(
        { success: false, error: "SESSION_NOT_FOUND" },
        { status: 404 },
      );
    }

    if (
      session.userAddress &&
      session.userAddress.toLowerCase() !== String(user).toLowerCase()
    ) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED" },
        { status: 403 },
      );
    }

    if (!session.roundSummary) {
      return NextResponse.json(
        { success: false, error: "ROUND_SUMMARY_UNAVAILABLE" },
        { status: 409 },
      );
    }

    if (!["flipped", "revealed"].includes(session.status)) {
      if (session.status === "submitted") {
        return NextResponse.json(
          { success: false, error: "SESSION_ALREADY_SUBMITTED" },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { success: false, error: "SESSION_NOT_FINALISED" },
        { status: 409 },
      );
    }

    const chain = COINFLIP_CHAIN_ID === base.id ? base : baseSepolia;
    const rpcUrl =
      process.env.RPC_URL_BASE_SEPOLIA ??
      chain.rpcUrls?.default?.http?.[0] ??
      "https://base-sepolia.g.alchemy.com/v2/demo";

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    const nonce = await publicClient.readContract({
      address: XP_REGISTRY_ADDRESS,
      abi: XP_REGISTRY_ABI,
      functionName: "getNonce",
      args: [user as `0x${string}`, COINFLIP_GAME_ID_BIGINT],
    });

    const account = getCoinFlipSignerAccount();
    console.log({account})

    const finalDeadline =
      BigInt(deadline ?? Math.floor(Date.now() / 1000) + 600);
    const finalXpDeadline =
      BigInt(xpDeadline ?? Math.floor(Date.now() / 1000) + 900);

    let wagerValue: bigint;
    try {
      wagerValue = BigInt(wagerWei);
    } catch {
      return NextResponse.json(
        { success: false, error: "INVALID_WAGER_VALUE" },
        { status: 400 },
      );
    }
    const normalizedWager = wagerValue.toString();

    if (!session.wagerWei) {
      return NextResponse.json(
        { success: false, error: "WAGER_NOT_REGISTERED" },
        { status: 409 },
      );
    }

    if (session.wagerWei !== normalizedWager) {
      return NextResponse.json(
        { success: false, error: "WAGER_MISMATCH" },
        { status: 409 },
      );
    }

    const summary = session.roundSummary;
    const guessEnum = mapOutcomeToEnum(summary.guess ?? "Heads");
    const outcomeEnum = mapOutcomeToEnum(summary.outcome ?? "Heads");
    const xpValue = Math.max(1, Math.floor(summary.xp ?? 1));
    const multiplierX100Value = BigInt(Math.max(0, summary.multiplierX100 ?? 0));

    const message = {
      user: user as `0x${string}`,
      gameId: COINFLIP_GAME_ID_BIGINT,
      sessionId: BigInt(session.id),
      guess: guessEnum,
      outcome: outcomeEnum,
      wager: wagerValue,
      multiplierX100: multiplierX100Value,
      xp: BigInt(xpValue),
      deadline: finalDeadline,
    };

    const resultSignature = await account.signTypedData({
      domain: COINFLIP_DOMAIN,
      primaryType: "Result",
      types: RESULT_TYPES,
      message,
    });

    const xpMessage = {
      user: user as `0x${string}`,
      gameId: COINFLIP_GAME_ID_BIGINT,
      amount: BigInt(xpValue),
      nonce,
      deadline: finalXpDeadline,
    };

    const xpSignature = await account.signTypedData({
      domain: XP_DOMAIN,
      primaryType: "XPAdd",
      types: XP_TYPES,
      message: xpMessage,
    });

    await updateSessionRecord(String(sessionId), {
      status: "submitted",
      finalizedAt: session.finalizedAt ?? Date.now(),
    });
    await removeSessionRecord(String(sessionId));

    return NextResponse.json({
      success: true,
      resultSignature,
      xpSignature,
      nonce: nonce.toString(),
      xpDeadline: finalXpDeadline.toString(),
      deadline: finalDeadline.toString(),
    });
  } catch (error) {
    console.error("[API] /coinflip/sign failed:", error);
    return NextResponse.json(
      { success: false, error: "SIGNING_FAILED" },
      { status: 500 },
    );
  }
}
