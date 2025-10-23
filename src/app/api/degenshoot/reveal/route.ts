import { NextResponse } from "next/server";
import { getSessionRecord, updateSessionRecord } from "../sessionStore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
    if (!sessionId) {
      return NextResponse.json({ success: false, error: "INVALID_REQUEST" }, { status: 400 });
    }

    const session = await getSessionRecord(sessionId);
    if (!session) {
      return NextResponse.json({ success: false, error: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    if (!session.rows.length) {
      return NextResponse.json({ success: false, error: "SESSION_NOT_INITIALISED" }, { status: 409 });
    }

    if (!["cashout", "completed", "lost", "revealed", "submitted"].includes(session.status)) {
      return NextResponse.json({ success: false, error: "SESSION_NOT_FINAL" }, { status: 409 });
    }

    // Preserve "lost" status when revealing, only change to "revealed" for won games
    const newStatus = session.status === "lost" ? "lost" : "revealed";

    await updateSessionRecord(sessionId, {
      status: newStatus,
      finalizedAt: session.finalizedAt ?? Date.now(),
    });

    return NextResponse.json({
      success: true,
      sessionId,
      serverSeed: session.serverSeed,
      clientSeed: session.clientSeed,
      serverSeedHash: session.serverSeedHash,
      nonceBase: session.nonceBase,
      roundSummary: session.roundSummary,
      rows: session.rows.map((row) => ({
        rowIndex: row.rowIndex,
        tileCount: row.tileCount,
        bombIndex: row.bombIndex,
        rowMultiplier: row.rowMultiplier,
        nonce: row.nonce,
        gameHash: row.gameHash,
        bombsPerRow: row.bombsPerRow,
        probabilities: row.probabilities,
      })),
    });
  } catch (error) {
    console.error("[API] /degenshoot/reveal failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "REVEAL_FAILED",
      },
      { status: 500 },
    );
  }
}
