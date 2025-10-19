import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createPublicClient, createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  SUNDAY_QUEST_GAME_ID,
  XP_REGISTRY_ADDRESS,
  QUEST_SIGNER_PRIVATE_KEY,
  XP_REGISTRY_DOMAIN,
  XP_ADD_TYPES,
} from "@/lib/sunday-quest/constants";
import { calculateQuestXP } from "@/lib/sunday-quest/xp-calculator";
import { XP_REGISTRY_ABI } from "@/lib/contracts/xpRegistry";

const prisma = new PrismaClient();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { questId, userAddress } = await request.json();

    if (!questId || !userAddress) {
      return NextResponse.json(
        { error: "Missing questId or userAddress" },
        { status: 400 }
      );
    }

    const normalizedAddress = userAddress.toLowerCase() as `0x${string}`;

    // Find quest progress with template
    const progress = await prisma.userQuestProgress.findFirst({
      where: {
        userAddress: normalizedAddress,
        questTemplateId: questId,
        status: "COMPLETED",
      },
      include: {
        questTemplate: true,
      },
    });

    if (!progress) {
      return NextResponse.json(
        { error: "Quest not completed or not found" },
        { status: 400 }
      );
    }

    if (progress.claimedAt) {
      return NextResponse.json(
        { error: "Quest XP already claimed" },
        { status: 400 }
      );
    }

    // Calculate XP reward
    const completionTimeMinutes =
      progress.completedAt && progress.startedAt
        ? Math.floor(
            (progress.completedAt.getTime() - progress.startedAt.getTime()) /
              60000
          )
        : undefined;

    const xpAmount = calculateQuestXP(progress.questTemplate, {
      previousCompletions: 0, // First time
      completionTime: completionTimeMinutes,
    });

    // Get nonce from XPRegistry
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(
        process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
      ),
    });

    const nonce = await publicClient.readContract({
      address: XP_REGISTRY_ADDRESS,
      abi: XP_REGISTRY_ABI,
      functionName: "getNonce",
      args: [normalizedAddress, BigInt(SUNDAY_QUEST_GAME_ID)],
    });

    // Create EIP-712 signature
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600); // 10 min expiry

    const payload = {
      user: normalizedAddress,
      gameId: BigInt(SUNDAY_QUEST_GAME_ID),
      amount: BigInt(xpAmount),
      nonce: nonce as bigint,
      deadline,
    };

    const questSigner = privateKeyToAccount(QUEST_SIGNER_PRIVATE_KEY);
    const walletClient = createWalletClient({
      account: questSigner,
      chain: baseSepolia,
      transport: http(
        process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
      ),
    });

    const signature = await walletClient.signTypedData({
      domain: XP_REGISTRY_DOMAIN,
      types: XP_ADD_TYPES,
      primaryType: "XPAdd",
      message: payload,
    });

    // Update progress with XP amount (not claimed yet)
    await prisma.userQuestProgress.update({
      where: { id: progress.id },
      data: { xpAwarded: xpAmount },
    });

    return NextResponse.json({
      success: true,
      xpAwarded: xpAmount,
      signature,
      payload: {
        user: payload.user,
        gameId: payload.gameId.toString(),
        amount: payload.amount.toString(),
        nonce: payload.nonce.toString(),
        deadline: payload.deadline.toString(),
      },
    });
  } catch (error) {
    console.error("Failed to generate claim signature:", error);
    return NextResponse.json(
      { error: "Failed to generate claim signature" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
