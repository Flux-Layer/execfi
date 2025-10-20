import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  ensureCurrentRotation,
  isSunday,
  getCurrentSunday,
} from "@/lib/sunday-quest/rotation";
import { addDays } from "date-fns";

const prisma = new PrismaClient();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get("address")?.toLowerCase();

    // Check if Sunday (optional - can remove to allow access any day)
    // if (!isSunday()) {
    //   const nextSunday = addDays(getCurrentSunday(), 7);
    //   return NextResponse.json(
    //     {
    //       error: "Sunday Quest is only available on Sundays (UTC)",
    //       nextSunday: nextSunday.toISOString(),
    //     },
    //     { status: 403 }
    //   );
    // }

    // Get or create current rotation
    const rotation = await ensureCurrentRotation();

    // Fetch quest templates
    const quests = await prisma.questTemplate.findMany({
      where: {
        id: { in: rotation.questSlots as number[] },
      },
      orderBy: [{ difficulty: "asc" }, { id: "asc" }],
    });

    // Fetch user progress if authenticated
    let userProgress: any[] = [];
    if (userAddress) {
      userProgress = await prisma.userQuestProgress.findMany({
        where: {
          userAddress,
          rotationId: rotation.id,
        },
      });
    }

    // Use different cache headers based on whether user data is included
    const cacheHeaders = userAddress
      ? {
          // Private cache for authenticated users, very short duration for real-time updates
          "Cache-Control": "private, max-age=2, must-revalidate",
        }
      : {
          // Public cache for unauthenticated users, longer duration
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        };

    return NextResponse.json(
      {
        rotation: {
          id: rotation.id,
          weekStartDate: rotation.weekStartDate,
          weekEndDate: rotation.weekEndDate,
          isActive: rotation.isActive,
        },
        quests,
        userProgress,
      },
      {
        headers: cacheHeaders,
      }
    );
  } catch (error) {
    console.error("Failed to fetch current quests:", error);
    return NextResponse.json(
      { error: "Failed to fetch quests" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
