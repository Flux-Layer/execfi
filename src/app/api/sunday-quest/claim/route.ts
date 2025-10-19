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

    // Validate environment variables
    if (!QUEST_SIGNER_PRIVATE_KEY || !QUEST_SIGNER_PRIVATE_KEY.startsWith('0x')) {
      console.error("[Claim API] QUEST_SIGNER_PRIVATE_KEY is missing or invalid");
      return NextResponse.json(
        { error: "Server configuration error: Missing signer key" },
        { status: 500 }
      );
    }

    if (!XP_REGISTRY_ADDRESS || !XP_REGISTRY_ADDRESS.startsWith('0x')) {
      console.error("[Claim API] XP_REGISTRY_ADDRESS is missing or invalid");
      return NextResponse.json(
        { error: "Server configuration error: Missing registry address" },
        { status: 500 }
      );
    }

    console.log(`[Claim API] Processing claim for quest ${questId}, user ${userAddress}`);
    console.log(`[Claim API] Game ID: ${SUNDAY_QUEST_GAME_ID}`);
    console.log(`[Claim API] XP Registry: ${XP_REGISTRY_ADDRESS}`);

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
    console.log(`[Claim API] Creating RPC client for Base Sepolia...`);
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(
        process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
      ),
    });

    console.log(`[Claim API] Reading nonce from XP Registry...`);
    const nonce = await publicClient.readContract({
      address: XP_REGISTRY_ADDRESS,
      abi: XP_REGISTRY_ABI,
      functionName: "getNonce",
      args: [normalizedAddress, BigInt(SUNDAY_QUEST_GAME_ID)],
    });
    console.log(`[Claim API] Nonce: ${nonce}`);

    // Create EIP-712 signature
    console.log(`[Claim API] Creating signature payload...`);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600); // 10 min expiry

    const payload = {
      user: normalizedAddress,
      gameId: BigInt(SUNDAY_QUEST_GAME_ID),
      amount: BigInt(xpAmount),
      nonce: nonce as bigint,
      deadline,
    };

    console.log(`[Claim API] Payload:`, {
      user: payload.user,
      gameId: payload.gameId.toString(),
      amount: payload.amount.toString(),
      nonce: payload.nonce.toString(),
      deadline: payload.deadline.toString(),
    });

    console.log(`[Claim API] Creating signer account...`);
    const questSigner = privateKeyToAccount(QUEST_SIGNER_PRIVATE_KEY);
    console.log(`[Claim API] Signer address: ${questSigner.address}`);

    const walletClient = createWalletClient({
      account: questSigner,
      chain: baseSepolia,
      transport: http(
        process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
      ),
    });

    console.log(`[Claim API] Signing typed data...`);
    const signature = await walletClient.signTypedData({
      domain: XP_REGISTRY_DOMAIN,
      types: XP_ADD_TYPES,
      primaryType: "XPAdd",
      message: payload,
    });
    console.log(`[Claim API] Signature generated: ${signature.substring(0, 20)}...`);

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
    console.error("[Claim API] Failed to generate claim signature:", error);
    
    // Provide more specific error messages
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Claim API] Error details:", errorMessage);
    
    return NextResponse.json(
      { 
        error: "Failed to generate claim signature",
        details: errorMessage,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
