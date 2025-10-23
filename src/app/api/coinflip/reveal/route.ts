import { NextResponse } from "next/server";
import {
  getSessionRecord,
  updateSessionRecord,
} from "../sessionStore";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    const session = await getSessionRecord(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "SESSION_NOT_FOUND" },
        { status: 404 },
      );
    }

    if (!["flipped", "revealed", "submitted"].includes(session.status)) {
      return NextResponse.json(
        { success: false, error: "SESSION_NOT_FINAL" },
        { status: 409 },
      );
    }

    if (session.status !== "revealed") {
      await updateSessionRecord(sessionId, {
        status: session.status === "submitted" ? "submitted" : "revealed",
        finalizedAt: session.finalizedAt ?? Date.now(),
      });
    }

    return NextResponse.json({
      success: true,
      sessionId,
      serverSeed: session.serverSeed,
      clientSeed: session.clientSeed,
      serverSeedHash: session.serverSeedHash,
      guess: session.roundSummary?.guess ?? session.guess,
      outcome: session.roundSummary?.outcome ?? session.outcome,
      summary: session.roundSummary,
    });
  } catch (error) {
    console.error("[API] /coinflip/reveal failed:", error);
    return NextResponse.json(
      { success: false, error: "REVEAL_FAILED" },
      { status: 500 },
    );
  }
}
