import { NextRequest, NextResponse } from "next/server";
import { ensureCurrentRotation } from "@/lib/sunday-quest/rotation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expectedAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rotation = await ensureCurrentRotation();

    return NextResponse.json({
      success: true,
      rotation: {
        id: rotation.id,
        weekStartDate: rotation.weekStartDate,
        questCount: (rotation.questSlots as number[]).length,
        seed: rotation.seed,
      },
    });
  } catch (error) {
    console.error("Failed to generate quests:", error);
    return NextResponse.json(
      { error: "Failed to generate quests" },
      { status: 500 }
    );
  }
}
