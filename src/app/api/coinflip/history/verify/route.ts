import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  deriveOutcome,
  hashSeed,
} from "@/lib/games/coinflip/fairness";
import { normalizeCoinSide } from "@/lib/games/coinflip/config";
import { getSessionRecord } from "../../sessionStore";

type VerifyRequest = {
  sessionId?: string | null;
  historyId?: number | string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as VerifyRequest;
    const rawSessionId =
      typeof body.sessionId === "string" && body.sessionId.trim().length > 0
        ? body.sessionId.trim()
        : null;
    const MAX_INT_32 = 2_147_483_647;
    const historyIdInput =
      body.historyId ?? (body as Record<string, unknown> & { id?: unknown }).id;
    const rawHistoryId =
      typeof historyIdInput === "number"
        ? historyIdInput
        : typeof historyIdInput === "string" && historyIdInput.trim().length > 0
          ? Number(historyIdInput.trim())
          : null;

    if (!rawSessionId && !rawHistoryId) {
      return NextResponse.json(
        { success: false, error: "IDENTIFIER_REQUIRED" },
        { status: 400 },
      );
    }

    const searchInputs: Array<Record<string, unknown>> = [];
    const toValidId = (value: string | number | null): number | null => {
      if (value === null) return null;
      const numeric = typeof value === "number" ? value : Number(value);
      if (
        Number.isSafeInteger(numeric) &&
        numeric > 0 &&
        numeric <= MAX_INT_32
      ) {
        return numeric;
      }
      return null;
    };

    if (rawSessionId) {
      searchInputs.push({ sessionId: rawSessionId });
      const numericSessionId = toValidId(rawSessionId);
      if (numericSessionId !== null) {
        searchInputs.push({ id: numericSessionId });
      }
    }
    const numericHistoryId = toValidId(rawHistoryId);
    if (numericHistoryId !== null) {
      searchInputs.push({ id: numericHistoryId });
    }

    let historyEntry: Awaited<ReturnType<typeof prisma.coinFlipHistory.findFirst>> | null = null;
    for (const where of searchInputs) {
      historyEntry = await prisma.coinFlipHistory.findFirst({
        where,
        orderBy: { createdAt: "desc" },
      });
      if (historyEntry) break;
    }

    const candidateSessionId =
      historyEntry?.sessionId ??
      rawSessionId ??
      (historyEntry?.id ? String(historyEntry.id) : null);

    let serverSeed: string | null = historyEntry?.serverSeed ?? null;
    let clientSeed: string | null = historyEntry?.clientSeed ?? null;
    let serverSeedHash: string | null = historyEntry?.serverSeedHash ?? null;
    let randomValue: number | null = null;

    const historyRandomValue = historyEntry?.randomValue;
    if (typeof historyRandomValue === "bigint") {
      randomValue = Number(historyRandomValue);
    } else if (typeof historyRandomValue === "number") {
      randomValue = historyRandomValue;
    }

    let sessionRecord: Awaited<ReturnType<typeof getSessionRecord>> | undefined;

    if ((!historyEntry || !historyEntry.serverSeed || !historyEntry.clientSeed) && candidateSessionId) {
      sessionRecord = await getSessionRecord(candidateSessionId);
      if (sessionRecord) {
        serverSeed = serverSeed ?? sessionRecord.serverSeed;
        clientSeed = clientSeed ?? sessionRecord.clientSeed;
        serverSeedHash = serverSeedHash ?? sessionRecord.serverSeedHash;
        randomValue =
          randomValue ??
          sessionRecord.roundSummary?.randomValue ??
          deriveOutcome(sessionRecord.serverSeed, sessionRecord.clientSeed).randomValue;
      }
    }

    if (!historyEntry && !sessionRecord) {
      return NextResponse.json(
        { success: false, error: "HISTORY_NOT_FOUND" },
        { status: 404 },
      );
    }

    serverSeed = serverSeed ?? sessionRecord?.serverSeed ?? null;
    clientSeed = clientSeed ?? sessionRecord?.clientSeed ?? null;
    serverSeedHash = serverSeedHash ?? sessionRecord?.serverSeedHash ?? null;
    randomValue = randomValue ?? sessionRecord?.roundSummary?.randomValue ?? null;

    if (!serverSeed || !clientSeed) {
      return NextResponse.json(
        { success: false, error: "SEEDS_UNAVAILABLE" },
        { status: 409 },
      );
    }

    serverSeedHash = serverSeedHash ?? hashSeed(serverSeed);

    const derived = deriveOutcome(serverSeed, clientSeed);
    const summary = historyEntry
      ? (() => {
          const guess = normalizeCoinSide(historyEntry.guess) ?? derived.outcome;
          const outcome = normalizeCoinSide(historyEntry.outcome) ?? derived.outcome;
          return {
            guess,
            outcome,
            correct: outcome === guess,
            multiplierX100: historyEntry.payoutMultiplier,
            xp: historyEntry.xp,
            wagerWei: historyEntry.wagerWei,
            randomValue: randomValue ?? derived.randomValue,
            timestamp: historyEntry.createdAt.getTime(),
          };
        })()
      : (() => {
          const guess =
            normalizeCoinSide(
              sessionRecord?.roundSummary?.guess ?? sessionRecord?.guess,
            ) ?? derived.outcome;
          const outcome =
            normalizeCoinSide(
              sessionRecord?.roundSummary?.outcome ?? sessionRecord?.outcome,
            ) ?? derived.outcome;
          const multiplierX100 =
            sessionRecord?.roundSummary?.multiplierX100 ?? sessionRecord?.multiplierX100 ?? 0;
          const xpValue = sessionRecord?.roundSummary?.xp ?? sessionRecord?.xp ?? 0;
          const wagerWeiValue =
            sessionRecord?.roundSummary?.wagerWei ?? sessionRecord?.wagerWei ?? null;
          const timestampValue =
            sessionRecord?.roundSummary?.timestamp ?? sessionRecord?.finalizedAt ?? Date.now();
          return {
            guess,
            outcome,
            correct: outcome === guess,
            multiplierX100,
            xp: xpValue,
            wagerWei: wagerWeiValue,
            randomValue: randomValue ?? derived.randomValue,
            timestamp: timestampValue,
          };
        })();

    if (historyEntry) {
      const updates: Record<string, unknown> = {};
      if (!historyEntry.serverSeed) updates.serverSeed = serverSeed;
      if (!historyEntry.clientSeed) updates.clientSeed = clientSeed;
      if (!historyEntry.serverSeedHash) updates.serverSeedHash = serverSeedHash;
      if (historyEntry.randomValue === null || typeof historyEntry.randomValue === "undefined") {
        updates.randomValue =
          typeof summary.randomValue === "number"
            ? summary.randomValue
            : summary.randomValue ?? null;
      }
      if (!historyEntry.revealedAt) {
        updates.revealedAt = new Date();
      }
      if (Object.keys(updates).length > 0) {
        await prisma.coinFlipHistory
          .update({
            where: { id: historyEntry.id },
            data: updates,
          })
          .catch(() => {});
      }
    }

    const responseSessionId =
      historyEntry?.sessionId ??
      sessionRecord?.id ??
      (candidateSessionId ? String(candidateSessionId) : historyEntry ? String(historyEntry.id) : null);

    return NextResponse.json({
      success: true,
      sessionId: responseSessionId,
      serverSeed,
      clientSeed,
      serverSeedHash,
      derivedOutcome: derived.outcome,
      verified: derived.outcome === summary.outcome,
      roundSummary: summary,
      summary,
    });
  } catch (error) {
    console.error("[API] /coinflip/history/verify failed:", error);
    return NextResponse.json(
      { success: false, error: "VERIFY_FAILED" },
      { status: 500 },
    );
  }
}
