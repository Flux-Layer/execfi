import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import type { CoinFlipSide } from "@/lib/games/coinflip/config";
import { deriveOutcome } from "@/lib/games/coinflip/fairness";

export type CoinFlipSessionStatus =
  | "pending"
  | "ready"
  | "wagerRegistered"
  | "flipped"
  | "revealed"
  | "submitted";

export type CoinFlipRoundSummary = {
  guess: CoinFlipSide | null;
  outcome: CoinFlipSide | null;
  correct: boolean;
  multiplierX100: number;
  xp: number;
  wagerWei: string | null;
  randomValue?: number;
  timestamp: number;
};

export type CoinFlipSessionRecord = {
  id: string;
  userAddress?: `0x${string}`;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  createdAt: number;
  wagerWei?: string;
  status: CoinFlipSessionStatus;
  guess: CoinFlipSide | null;
  outcome: CoinFlipSide | null;
  multiplierX100: number;
  xp: number;
  finalizedAt: number | null;
  roundSummary: CoinFlipRoundSummary | null;
};

const SESSION_TTL_HOURS = parseInt(process.env.SESSION_TTL_HOURS || "24", 10);

function randomSessionId(): string {
  const buffer = crypto.randomBytes(8);
  const value = buffer.readBigUInt64BE(0);
  return value.toString();
}

function recordToDb(record: CoinFlipSessionRecord) {
  const expiresAt = new Date(record.createdAt);
  expiresAt.setHours(expiresAt.getHours() + SESSION_TTL_HOURS);

  const lockedTileCounts: number[] = [];
  const rows: unknown[] = [];

  return {
    id: record.id,
    userAddress: record.userAddress ?? null,
    serverSeed: record.serverSeed,
    serverSeedHash: record.serverSeedHash,
    clientSeed: record.clientSeed,
    createdAt: BigInt(record.createdAt),
    wagerWei: record.wagerWei ?? null,
    nonceBase: numberFromHash(record.serverSeedHash),
    status: record.status,
    rows: rows as Prisma.InputJsonValue,
    currentRow: 0,
    currentMultiplier: 1,
    completedRows: 0,
    lockedTileCounts: lockedTileCounts as Prisma.InputJsonValue,
    roundSummary: record.roundSummary
      ? (record.roundSummary as Prisma.InputJsonValue)
      : Prisma.DbNull,
    finalizedAt: record.finalizedAt ? BigInt(record.finalizedAt) : null,
    expiresAt,
    isActive: record.status !== "submitted",
  };
}

function dbToRecord(db: any): CoinFlipSessionRecord {
  const storedSummary =
    (db.roundSummary as CoinFlipRoundSummary | null | undefined) ?? null;
  return {
    id: db.id,
    userAddress: db.userAddress ? (db.userAddress as `0x${string}`) : undefined,
    serverSeed: db.serverSeed,
    serverSeedHash: db.serverSeedHash,
    clientSeed: db.clientSeed,
    createdAt: Number(db.createdAt),
    wagerWei: db.wagerWei ?? undefined,
    status: db.status as CoinFlipSessionStatus,
    guess: storedSummary?.guess ?? null,
    outcome: storedSummary?.outcome ?? null,
    multiplierX100: storedSummary?.multiplierX100 ?? 200,
    xp: storedSummary?.xp ?? 0,
    finalizedAt: db.finalizedAt ? Number(db.finalizedAt) : null,
    roundSummary: storedSummary,
  };
}

function numberFromHash(hash: string): number {
  const buffer = Buffer.from(hash.slice(0, 8), "hex");
  const raw = buffer.readUInt32BE(0);
  return raw & 0x7fffffff;
}

export async function createSessionRecord(
  overrides: Partial<CoinFlipSessionRecord> = {},
): Promise<CoinFlipSessionRecord> {
  const id = overrides.id ?? randomSessionId();
  const serverSeed = overrides.serverSeed ?? crypto.randomBytes(32).toString("hex");
  const serverSeedHash =
    overrides.serverSeedHash ??
    crypto.createHash("sha256").update(serverSeed).digest("hex");
  const clientSeed = overrides.clientSeed ?? crypto.randomBytes(16).toString("hex");

  const record: CoinFlipSessionRecord = {
    id,
    userAddress: overrides.userAddress,
    serverSeed,
    serverSeedHash,
    clientSeed,
    createdAt: Date.now(),
    wagerWei: overrides.wagerWei,
    status: overrides.status ?? "pending",
    guess: overrides.guess ?? null,
    outcome: overrides.outcome ?? null,
    multiplierX100: overrides.multiplierX100 ?? 200,
    xp: overrides.xp ?? 0,
    finalizedAt: overrides.finalizedAt ?? null,
    roundSummary: overrides.roundSummary ?? null,
  };

  await prisma.gameSession.create({ data: recordToDb(record) });
  return record;
}

export async function getSessionRecord(
  id: string,
): Promise<CoinFlipSessionRecord | undefined> {
  const db = await prisma.gameSession.findUnique({ where: { id } });
  if (!db) return undefined;

  if (new Date() > db.expiresAt) {
    await prisma.gameSession.delete({ where: { id } });
    return undefined;
  }

  return dbToRecord(db);
}

export async function updateSessionRecord(
  id: string,
  updates: Partial<CoinFlipSessionRecord>,
): Promise<CoinFlipSessionRecord | undefined> {
  const current = await getSessionRecord(id);
  if (!current) return undefined;

  const next: CoinFlipSessionRecord = {
    ...current,
    ...updates,
    roundSummary:
      typeof updates.roundSummary !== "undefined"
        ? updates.roundSummary
        : current.roundSummary,
  };

  await prisma.gameSession.update({
    where: { id },
    data: recordToDb(next),
  });

  return next;
}

export async function removeSessionRecord(id: string): Promise<void> {
  await prisma.gameSession.delete({ where: { id } }).catch(() => {});
}

export async function pruneExpiredSessions(ttlMs = 15 * 60 * 1000): Promise<void> {
  const cutoffDate = new Date(Date.now() - ttlMs);
  await prisma.gameSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { createdAt: { lt: BigInt(Date.now() - ttlMs) } },
      ],
    },
  });
}

export function computeOutcomeForSession(record: CoinFlipSessionRecord) {
  return deriveOutcome(record.serverSeed, record.clientSeed);
}
