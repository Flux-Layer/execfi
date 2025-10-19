import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { questId, userAddress, transactionHash } = await request.json();

    if (!questId || !userAddress) {
      return NextResponse.json(
        { error: "Missing questId or userAddress" },
        { status: 400 }
      );
    }

    const normalizedAddress = userAddress.toLowerCase();

    // Find the quest progress
    const progress = await prisma.userQuestProgress.findFirst({
      where: {
        userAddress: normalizedAddress,
        questTemplateId: questId,
        status: "COMPLETED",
      },
    });

    if (!progress) {
      return NextResponse.json(
        { error: "Quest not found or not completed" },
        { status: 404 }
      );
    }

    // Update to CLAIMED status
    await prisma.userQuestProgress.update({
      where: { id: progress.id },
      data: {
        status: "CLAIMED",
        claimedAt: new Date(),
        transactionHash: transactionHash || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to mark quest as claimed:", error);
    return NextResponse.json(
      { error: "Failed to mark quest as claimed" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
