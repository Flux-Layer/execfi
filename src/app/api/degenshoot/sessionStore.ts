import crypto from "crypto";
import type { RowFairnessMeta } from "@/lib/games/bomb/fairness";
import { prisma } from "@/lib/db/client";
import { Prisma, type GameSession } from "@prisma/client";

export type DegenshootSessionRecord = {
  id: string;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  createdAt: number;
  userAddress?: `0x${string}`;
  wagerWei?: string;
  nonceBase: number;
  status: "pending" | "active" | "cashout" | "completed" | "lost" | "revealed" | "submitted";
  rows: StoredRow[];
  currentRow: number;
  currentMultiplier: number;
  completedRows: number;
  lockedTileCounts: number[];
  roundSummary: {
    xp: number;
    kills: number;
    timeAlive: number;
    score: number;
    multiplier: number;
    completedRows: number;
  } | null;
  finalizedAt: number | null;

  // Transaction tracking fields
  wagerTxHash?: string;
  resultTxHash?: string;
  xpTxHash?: string;
};

export type StoredRow = RowFairnessMeta & {
  selectedColumn: number | null;
  crashed: boolean;
  isCompleted: boolean;
};

const SESSION_TTL_HOURS = parseInt(process.env.SESSION_TTL_HOURS || '24', 10);

// Helper to convert DB record to DegenshootSessionRecord
function dbToRecord(db: GameSession): DegenshootSessionRecord {
  return {
    id: db.id,
    serverSeed: db.serverSeed,
    serverSeedHash: db.serverSeedHash,
    clientSeed: db.clientSeed,
    createdAt: Number(db.createdAt),
    userAddress: db.userAddress as `0x${string}` | undefined,
    wagerWei: db.wagerWei || undefined,
    nonceBase: db.nonceBase,
    status: db.status as DegenshootSessionRecord["status"],
    rows: db.rows as StoredRow[],
    currentRow: db.currentRow,
    currentMultiplier: db.currentMultiplier,
    completedRows: db.completedRows,
    lockedTileCounts: db.lockedTileCounts as number[],
    roundSummary: db.roundSummary as DegenshootSessionRecord["roundSummary"],
    finalizedAt: db.finalizedAt ? Number(db.finalizedAt) : null,

    // Transaction tracking fields
    wagerTxHash: db.wagerTxHash || undefined,
    resultTxHash: db.resultTxHash || undefined,
    xpTxHash: db.xpTxHash || undefined,
  };
}

// Helper to convert DegenshootSessionRecord to DB format
function recordToDb(record: DegenshootSessionRecord) {
  const expiresAt = new Date(record.createdAt);
  expiresAt.setHours(expiresAt.getHours() + SESSION_TTL_HOURS);

  return {
    id: record.id,
    serverSeed: record.serverSeed,
    serverSeedHash: record.serverSeedHash,
    clientSeed: record.clientSeed,
    createdAt: BigInt(record.createdAt),
    userAddress: record.userAddress || null,
    wagerWei: record.wagerWei || null,
    nonceBase: record.nonceBase,
    status: record.status,
    rows: record.rows as Prisma.InputJsonValue,
    currentRow: record.currentRow,
    currentMultiplier: record.currentMultiplier,
    completedRows: record.completedRows,
    lockedTileCounts: record.lockedTileCounts as Prisma.InputJsonValue,
    roundSummary: record.roundSummary ? (record.roundSummary as Prisma.InputJsonValue) : Prisma.DbNull,
    finalizedAt: record.finalizedAt ? BigInt(record.finalizedAt) : null,
    expiresAt,
    isActive: true,

    // Transaction tracking fields
    wagerTxHash: record.wagerTxHash || null,
    resultTxHash: record.resultTxHash || null,
    xpTxHash: record.xpTxHash || null,
  };
}

function randomSessionId(): string {
  // 64-bit unsigned integer represented as decimal string
  const buffer = crypto.randomBytes(8);
  const value = buffer.readBigUInt64BE(0);
  return value.toString();
}

function randomHex(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export async function createSessionRecord(
  overrides: Partial<DegenshootSessionRecord> = {},
): Promise<DegenshootSessionRecord> {
  const id = overrides.id ?? randomSessionId();
  const serverSeed = overrides.serverSeed ?? randomHex(32);
  const serverSeedHash =
    overrides.serverSeedHash ??
    crypto.createHash("sha256").update(serverSeed).digest("hex");
  const clientSeed = overrides.clientSeed ?? randomHex(16);
  const nonceBase =
    overrides.nonceBase ??
    Number(BigInt(Date.now()) % BigInt(1_000_000)) ?? 0;

  const record: DegenshootSessionRecord = {
    id,
    serverSeed,
    serverSeedHash,
    clientSeed,
    createdAt: Date.now(),
    userAddress: overrides.userAddress,
    wagerWei: overrides.wagerWei,
    nonceBase,
    status: overrides.status ?? "pending",
    rows: overrides.rows ? overrides.rows.map((row) => ({ ...row })) : [],
    currentRow: overrides.currentRow ?? 0,
    currentMultiplier: overrides.currentMultiplier ?? 1,
    completedRows: overrides.completedRows ?? 0,
    lockedTileCounts: overrides.lockedTileCounts ? [...overrides.lockedTileCounts] : [],
    roundSummary: overrides.roundSummary ?? null,
    finalizedAt: overrides.finalizedAt ?? null,
  };

  await prisma.gameSession.create({ data: recordToDb(record) });
  return record;
}

export async function getSessionRecord(
  id: string,
): Promise<DegenshootSessionRecord | undefined> {
  const db = await prisma.gameSession.findUnique({ where: { id } });
  if (!db) return undefined;
  
  // Check if expired
  if (new Date() > db.expiresAt) {
    await prisma.gameSession.delete({ where: { id } });
    return undefined;
  }
  
  return dbToRecord(db);
}

export async function updateSessionRecord(
  id: string,
  updates: Partial<DegenshootSessionRecord>,
): Promise<DegenshootSessionRecord | undefined> {
  try {
    const current = await getSessionRecord(id);
    if (!current) return undefined;
    
    const next: DegenshootSessionRecord = {
      ...current,
      ...updates,
      rows: updates.rows ? updates.rows.map((row) => ({ ...row })) : current.rows,
      lockedTileCounts: updates.lockedTileCounts
        ? [...updates.lockedTileCounts]
        : current.lockedTileCounts,
      roundSummary:
        typeof updates.roundSummary !== "undefined"
          ? updates.roundSummary
          : current.roundSummary,
      finalizedAt:
        typeof updates.finalizedAt !== "undefined" ? updates.finalizedAt : current.finalizedAt,
    };
    
    await prisma.gameSession.update({
      where: { id },
      data: recordToDb(next),
    });
    
    return next;
  } catch (error) {
    console.error('[SessionStore] Update failed:', error);
    return undefined;
  }
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

// New function for auth-based session restoration
export async function restoreUserSession(userAddress: string): Promise<DegenshootSessionRecord | null> {
  const sessions = await prisma.gameSession.findMany({
    where: { 
      userAddress, 
      isActive: true,
      status: { in: ['pending', 'active'] },
    },
    orderBy: { updatedAt: 'desc' },
    take: 1,
  });

  if (sessions.length === 0) return null;

  const session = sessions[0];
  if (new Date() > session.expiresAt) {
    await prisma.gameSession.delete({ where: { id: session.id } });
    return null;
  }

  return dbToRecord(session);
}

// New function for clearing user sessions on logout
export async function clearUserSessions(userAddress: string): Promise<number> {
  const result = await prisma.gameSession.updateMany({
    where: { userAddress, isActive: true },
    data: { isActive: false },
  });
  return result.count;
}
