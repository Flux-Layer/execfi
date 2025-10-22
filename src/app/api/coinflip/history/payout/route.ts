import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const sessionIdRaw = body?.sessionId;
    const txHashRaw = body?.txHash;
    const MAX_INT_32 = 2_147_483_647;

    if (typeof sessionIdRaw !== "string" || !sessionIdRaw.trim()) {
      return NextResponse.json(
        { success: false, error: "SESSION_ID_REQUIRED" },
        { status: 400 }
      );
    }

    if (typeof txHashRaw !== "string" || !txHashRaw.trim()) {
      return NextResponse.json(
        { success: false, error: "TX_HASH_REQUIRED" },
        { status: 400 }
      );
    }

    const sessionId = sessionIdRaw.trim();
    const txHash = txHashRaw.trim();

    const bySession = await prisma.coinFlipHistory.updateMany({
      where: {
        sessionId,
        payoutMultiplier: {
          gt: 0,
        },
      },
      data: { payoutTxHash: txHash },
    });

    let totalUpdated = bySession.count;

    if (totalUpdated === 0) {
      const numericId = Number(sessionId);
      if (
        Number.isSafeInteger(numericId) &&
        numericId > 0 &&
        numericId <= MAX_INT_32
      ) {
        const byNumericId = await prisma.coinFlipHistory.updateMany({
          where: {
            id: numericId,
            payoutMultiplier: {
              gt: 0,
            },
          },
          data: { payoutTxHash: txHash },
        });
        totalUpdated += byNumericId.count;
      }
    }

    return NextResponse.json({ success: true, updated: totalUpdated });
  } catch (error) {
    console.error("[API] /coinflip/history/payout failed:", error);
    return NextResponse.json(
      { success: false, error: "PAYOUT_RECORD_FAILED" },
      { status: 500 }
    );
  }
}
