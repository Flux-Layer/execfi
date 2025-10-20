import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  verifyETHTransfer,
  verifyGameSessions,
  verifyVaultDeposit,
  verifyTransactionCount,
} from "@/lib/sunday-quest/verification";
import { 
  verifyETHTransfersViaRPC,
  verifySwapsViaRPC,
  verifyTransactionCountViaRPC,
  verifyGasOptimizationViaRPC,
} from "@/lib/sunday-quest/verification/rpc-verifier";

const prisma = new PrismaClient();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { questId, userAddress } = await request.json();

    if (!questId || !userAddress) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const normalizedAddress = userAddress.toLowerCase();

    // Get quest template and progress
    const [quest, progress] = await Promise.all([
      prisma.questTemplate.findUnique({ where: { id: questId } }),
      prisma.userQuestProgress.findFirst({
        where: {
          userAddress: normalizedAddress,
          questTemplateId: questId,
          status: { in: ["IN_PROGRESS", "PENDING_VERIFICATION"] },
        },
      }),
    ]);

    if (!quest) {
      return NextResponse.json({ error: "Quest not found" }, { status: 404 });
    }

    if (!progress) {
      return NextResponse.json(
        { error: "Quest not started or already completed" },
        { status: 400 }
      );
    }

    // Get week start timestamp for this rotation
    const rotation = await prisma.weeklyQuestRotation.findUnique({
      where: { id: progress.rotationId },
    });

    if (!rotation) {
      return NextResponse.json(
        { error: "Rotation not found" },
        { status: 404 }
      );
    }

    const weekStartTimestamp = Math.floor(
      rotation.weekStartDate.getTime() / 1000
    );

    // Verify based on quest requirements
    let result;
    const requirements = quest.requirements as any;

    // Determine quest type from requirements
    if (requirements.transactionType === "transfer") {
      // Use Alchemy RPC for ETH transfer verification
      const startTimestamp = progress.startedAt 
        ? Math.floor(progress.startedAt.getTime() / 1000)
        : weekStartTimestamp;
      
      // Convert minAmount from wei to ETH if needed
      const minAmountWei = requirements.minAmount || "10000000000000"; // Default 0.00001 ETH in wei
      const minAmountETH = typeof minAmountWei === "string" 
        ? parseFloat(minAmountWei) / 1e18  // Convert wei string to ETH
        : minAmountWei; // Already in ETH
        
      console.log(`[Verify API] Converting min amount: ${minAmountWei} wei -> ${minAmountETH} ETH`);
        
      const rpcResult = await verifyETHTransfersViaRPC(
        normalizedAddress as `0x${string}`,
        startTimestamp,
        requirements.minTransactions || 3,
        minAmountETH
      );

      result = {
        success: rpcResult.count >= (requirements.minTransactions || 3),
        progress: rpcResult.percentage,
        message: `${rpcResult.count}/${requirements.minTransactions || 3} transactions completed`,
        metadata: {
          transactionCount: rpcResult.count,
          required: requirements.minTransactions || 3,
          transactions: rpcResult.transactions,
        },
      };
    } else if (requirements.transactionType === "swap") {
      // Use Alchemy RPC for swap verification
      const startTimestamp = progress.startedAt 
        ? Math.floor(progress.startedAt.getTime() / 1000)
        : weekStartTimestamp;
        
      const rpcResult = await verifySwapsViaRPC(
        normalizedAddress as `0x${string}`,
        startTimestamp,
        requirements.minTransactions || 1
      );

      result = {
        success: rpcResult.count >= (requirements.minTransactions || 1),
        progress: rpcResult.percentage,
        message: `${rpcResult.count}/${requirements.minTransactions || 1} swaps completed`,
        metadata: {
          transactionCount: rpcResult.count,  // Normalized field name
          required: requirements.minTransactions || 1,
          swapCount: rpcResult.count,
          swaps: rpcResult.transactions,
        },
      };
    } else if (requirements.transactionType === "game_play") {
      result = await verifyGameSessions(
        normalizedAddress,
        requirements,
        weekStartTimestamp
      );
    } else if (requirements.transactionType === "vault_deposit") {
      result = await verifyVaultDeposit(
        normalizedAddress,
        requirements,
        weekStartTimestamp
      );
    } else if (requirements.transactionType === "contract_call") {
      // Check if this is a gas optimization quest
      if (requirements.maxGasUsed) {
        // Use gas optimization verifier
        const startTimestamp = progress.startedAt 
          ? Math.floor(progress.startedAt.getTime() / 1000)
          : weekStartTimestamp;
          
        const rpcResult = await verifyGasOptimizationViaRPC(
          normalizedAddress as `0x${string}`,
          startTimestamp,
          requirements.minTransactions || 5,
          requirements.maxGasUsed
        );

        result = {
          success: rpcResult.count >= (requirements.minTransactions || 5),
          progress: rpcResult.percentage,
          message: `${rpcResult.count}/${requirements.minTransactions || 5} optimized transactions`,
          metadata: {
            transactionCount: rpcResult.count,
            required: requirements.minTransactions || 5,
            transactions: rpcResult.transactions,
            maxGasUsed: requirements.maxGasUsed,
          },
        };
      } else {
        // Regular transaction count verification
        const startTimestamp = progress.startedAt 
          ? Math.floor(progress.startedAt.getTime() / 1000)
          : weekStartTimestamp;
          
        const rpcResult = await verifyTransactionCountViaRPC(
          normalizedAddress as `0x${string}`,
          startTimestamp,
          requirements.minTransactions || 5
        );

        result = {
          success: rpcResult.count >= (requirements.minTransactions || 5),
          progress: rpcResult.percentage,
          message: `${rpcResult.count}/${requirements.minTransactions || 5} transactions completed`,
          metadata: {
            transactionCount: rpcResult.count,
            required: requirements.minTransactions || 5,
            transactions: rpcResult.transactions,
          },
        };
      }
    } else {
      return NextResponse.json(
        { error: "Unsupported quest type" },
        { status: 400 }
      );
    }

    // Update progress
    if (result.success) {
      await prisma.userQuestProgress.update({
        where: { id: progress.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          progress: {
            percentage: 100,
            ...result.metadata,
          },
        },
      });

      // Create completion event
      await prisma.questCompletionEvent.create({
        data: {
          userAddress: normalizedAddress,
          questTemplateId: questId,
          rotationId: progress.rotationId,
          completionProof: result.metadata || {},
          verifiedAt: new Date(),
          xpAwarded: 0, // Will be set on claim
        },
      });
    } else if (result.progress !== undefined) {
      // Update progress percentage
      await prisma.userQuestProgress.update({
        where: { id: progress.id },
        data: {
          progress: {
            percentage: result.progress,
            ...result.metadata,
          },
        },
      });
    }

    return NextResponse.json({
      verified: result.success,
      progress: result.progress,
      message: result.message,
      canClaim: result.success,
      metadata: result.metadata, // Include metadata in response for debugging
    });
  } catch (error) {
    console.error("Verification failed:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
