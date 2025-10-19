import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { ensureCurrentRotation } from "@/lib/sunday-quest/rotation";

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

    const normalizedAddress = userAddress.toLowerCase();

    // Get current rotation
    const rotation = await ensureCurrentRotation();

    // Verify quest is in current rotation
    const questSlots = rotation.questSlots as number[];
    if (!questSlots.includes(questId)) {
      return NextResponse.json(
        { error: "Quest not available in current rotation" },
        { status: 400 }
      );
    }

    // Check if already started or completed
    const existing = await prisma.userQuestProgress.findUnique({
      where: {
        userAddress_rotationId_questTemplateId: {
          userAddress: normalizedAddress,
          rotationId: rotation.id,
          questTemplateId: questId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        progress: existing,
        message: "Quest already started",
      });
    }

    // Create progress record
    const progress = await prisma.userQuestProgress.create({
      data: {
        userAddress: normalizedAddress,
        rotationId: rotation.id,
        questTemplateId: questId,
        status: "IN_PROGRESS",
        startedAt: new Date(),
        progress: {},
      },
    });

    return NextResponse.json({
      success: true,
      progress,
    });
  } catch (error) {
    console.error("Failed to start quest:", error);
    return NextResponse.json(
      { error: "Failed to start quest" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
