import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { prisma } from "@/lib/db/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    if (!address) {
      return NextResponse.json(
        { success: false, error: "ADDRESS_REQUIRED" },
        { status: 400 },
      );
    }

    let normalized: `0x${string}`;
    try {
      normalized = getAddress(address);
    } catch {
      return NextResponse.json(
        { success: false, error: "INVALID_ADDRESS" },
        { status: 400 },
      );
    }

    const entries = await prisma.coinFlipHistory.findMany({
      where: { userAddress: normalized.toLowerCase() },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const normalizedEntries = entries.map((entry) => ({
      ...entry,
      randomValue:
        entry.randomValue === null || typeof entry.randomValue === "undefined"
          ? null
          : Number(entry.randomValue),
    }));

    return NextResponse.json({ success: true, entries: normalizedEntries });
  } catch (error) {
    console.error("[API] /coinflip/history failed:", error);
    return NextResponse.json(
      { success: false, error: "HISTORY_FAILED" },
      { status: 500 },
    );
  }
}
