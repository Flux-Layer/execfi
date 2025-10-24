import crypto from "crypto";
import type { RowFairnessMeta } from "@/lib/games/bomb/fairness";
import { prisma } from "@/lib/db/client";
import { Prisma, type GameSession } from "@prisma/client";

type PrismaGameSession = GameSession & {
  wagerTxHash?: string | null;
  resultTxHash?: string | null;
  withdrawTxHash?: string | null;
  xpTxHash?: string | null;
};

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
  withdrawTxHash?: string;
  xpTxHash?: string;
};

export type StoredRow = RowFairnessMeta & {
  selectedColumn: number | null;
  crashed: boolean;
  isCompleted: boolean;
};

const SESSION_TTL_HOURS = parseInt(process.env.SESSION_TTL_HOURS || '24', 10);
const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;
const ACTIVE_STATUSES = new Set(["pending", "active"]);

type GlobalWithDegenshootStore = typeof globalThis & {
  __DEGENSHOOT_SESSIONS__?: Map<string, DegenshootSessionRecord>;
};

const globalStore = globalThis as GlobalWithDegenshootStore;
const inMemorySessions =
  globalStore.__DEGENSHOOT_SESSIONS__ ?? new Map<string, DegenshootSessionRecord>();
if (!globalStore.__DEGENSHOOT_SESSIONS__) {
  globalStore.__DEGENSHOOT_SESSIONS__ = inMemorySessions;
}

let databaseAvailable = Boolean(process.env.DATABASE_URL);
let databaseFailureLogged = false;

function logDatabaseFallback(error: unknown) {
  if (databaseFailureLogged) return;
  databaseFailureLogged = true;
  console.warn(
    "[SessionStore] Database unavailable, falling back to in-memory session storage.",
    error,
  );
}

function markDatabaseUnavailable(error: unknown) {
  if (!databaseAvailable) return;
  databaseAvailable = false;
  logDatabaseFallback(error);
}

function cloneRow(row: StoredRow): StoredRow {
  return {
    ...row,
    probabilities: row.probabilities.map((prob) => ({ ...prob })),
  };
}

function cloneRecord(record: DegenshootSessionRecord): DegenshootSessionRecord {
  return {
    ...record,
    rows: record.rows.map((row) => cloneRow(row)),
    lockedTileCounts: [...record.lockedTileCounts],
    roundSummary: record.roundSummary ? { ...record.roundSummary } : null,
  };
}

function isRecordExpired(record: DegenshootSessionRecord, ttlMs = SESSION_TTL_MS): boolean {
  const now = Date.now();
  const expiredByCreatedAt = now - record.createdAt > ttlMs;
  return expiredByCreatedAt;
}

function shouldRemoveRecord(record: DegenshootSessionRecord, ttlMs: number): boolean {
  return ACTIVE_STATUSES.has(record.status) && isRecordExpired(record, ttlMs);
}

function getFromMemory(id: string): DegenshootSessionRecord | undefined {
  const record = inMemorySessions.get(id);
  if (!record) return undefined;
  if (shouldRemoveRecord(record, SESSION_TTL_MS)) {
    inMemorySessions.delete(id);
    return undefined;
  }
  return cloneRecord(record);
}

function upsertMemoryRecord(record: DegenshootSessionRecord) {
  inMemorySessions.set(record.id, cloneRecord(record));
}

function updateMemoryRecord(
  current: DegenshootSessionRecord,
  updates: Partial<DegenshootSessionRecord>,
): DegenshootSessionRecord {
  const next: DegenshootSessionRecord = {
    ...current,
    ...updates,
    rows: updates.rows ? updates.rows.map((row) => cloneRow(row)) : current.rows.map((row) => cloneRow(row)),
    lockedTileCounts: updates.lockedTileCounts
      ? [...updates.lockedTileCounts]
      : [...current.lockedTileCounts],
    roundSummary:
      typeof updates.roundSummary !== "undefined"
        ? updates.roundSummary
          ? { ...updates.roundSummary }
          : null
        : current.roundSummary
        ? { ...current.roundSummary }
        : null,
  };

  upsertMemoryRecord(next);
  return next;
}

// Helper to convert DB record to DegenshootSessionRecord
function dbToRecord(db: PrismaGameSession): DegenshootSessionRecord {
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
    withdrawTxHash: db.withdrawTxHash || undefined,
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
    withdrawTxHash: record.withdrawTxHash || null,
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

  if (!databaseAvailable) {
    upsertMemoryRecord(record);
    return record;
  }

  try {
    await prisma.gameSession.create({ data: recordToDb(record) });
    upsertMemoryRecord(record);
    return record;
  } catch (error) {
    markDatabaseUnavailable(error);
    upsertMemoryRecord(record);
    return record;
  }
}

export async function getSessionRecord(
  id: string,
): Promise<DegenshootSessionRecord | undefined> {

  const db = await prisma.gameSession.findUnique({ where: { id } });
  if (!db) {
    console.log(`[SessionStore] Session ${id} not found in database`);
    return undefined;
  }

  // Check if expired - only delete if it's an unfinished session
  if (new Date() > db.expiresAt) {
    console.log(`[SessionStore] Session ${id} expired. ExpiresAt: ${db.expiresAt}, Now: ${new Date()}, Status: ${db.status}`);
    // Preserve completed/finalized games even if expired
    if (db.status === 'pending' || db.status === 'active') {
      console.log(`[SessionStore] Deleting expired session ${id}`);
      await prisma.gameSession.delete({ where: { id } });
      return undefined;
    }
  }

  try {
    const db = await prisma.gameSession.findUnique({ where: { id } });
    if (!db) return undefined;

    // Check if expired - only delete if it's an unfinished session
    if (new Date() > db.expiresAt) {
      // Preserve completed/finalized games even if expired
      if (db.status === 'pending' || db.status === 'active') {
        await prisma.gameSession.delete({ where: { id } });
        return undefined;
      }
    }

    const record = dbToRecord(db as PrismaGameSession);
    upsertMemoryRecord(record);
    return record;
  } catch (error) {
    markDatabaseUnavailable(error);
    return getFromMemory(id);
  }
}

export async function updateSessionRecord(
  id: string,
  updates: Partial<DegenshootSessionRecord>,
): Promise<DegenshootSessionRecord | undefined> {
  if (!databaseAvailable) {
    const current = inMemorySessions.get(id);
    if (!current) return undefined;
    return cloneRecord(updateMemoryRecord(current, updates));
  }

  try {
    const current = await getSessionRecord(id);
    if (!current) return undefined;

    const next: DegenshootSessionRecord = {
      ...current,
      ...updates,
      rows: updates.rows ? updates.rows.map((row) => cloneRow(row)) : current.rows.map((row) => cloneRow(row)),
      lockedTileCounts: updates.lockedTileCounts
        ? [...updates.lockedTileCounts]
        : [...current.lockedTileCounts],
      roundSummary:
        typeof updates.roundSummary !== "undefined"
          ? updates.roundSummary
            ? { ...updates.roundSummary }
            : null
          : current.roundSummary
          ? { ...current.roundSummary }
          : null,
      finalizedAt:
        typeof updates.finalizedAt !== "undefined" ? updates.finalizedAt : current.finalizedAt,
    };

    await prisma.gameSession.update({
      where: { id },
      data: recordToDb(next),
    });

    upsertMemoryRecord(next);
    return next;
  } catch (error) {
    console.error('[SessionStore] Update failed, attempting in-memory fallback:', error);
    markDatabaseUnavailable(error);
    const current = inMemorySessions.get(id);
    if (!current) return undefined;
    return cloneRecord(updateMemoryRecord(current, updates));
  }
}

export async function removeSessionRecord(id: string): Promise<void> {
  if (!databaseAvailable) {
    inMemorySessions.delete(id);
    return;
  }
  try {
    await prisma.gameSession.delete({ where: { id } });
    inMemorySessions.delete(id);
  } catch (error) {
    markDatabaseUnavailable(error);
    inMemorySessions.delete(id);
  }
}

export async function pruneExpiredSessions(ttlMs = 15 * 60 * 1000): Promise<void> {
  if (!databaseAvailable) {
    for (const [id, record] of inMemorySessions.entries()) {
      if (shouldRemoveRecord(record, ttlMs)) {
        inMemorySessions.delete(id);
      }
    }
    return;
  }

  try {
    const cutoffDate = new Date(Date.now() - ttlMs);
    await prisma.gameSession.deleteMany({
      where: {
        AND: [
          {
            OR: [
              { expiresAt: { lt: new Date() } },
              { createdAt: { lt: BigInt(Date.now() - ttlMs) } },
            ],
          },
          // Only delete unfinished/abandoned games, preserve completed history
          { status: { in: ['pending', 'active'] } },
        ],
      },
    });
    for (const [id, record] of inMemorySessions.entries()) {
      if (shouldRemoveRecord(record, ttlMs)) {
        inMemorySessions.delete(id);
      }
    }
  } catch (error) {
    markDatabaseUnavailable(error);
    await pruneExpiredSessions(ttlMs);
  }
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

  // Extend the expiration time when restoring to give user a fresh TTL window
  const newExpiresAt = new Date();
  newExpiresAt.setHours(newExpiresAt.getHours() + SESSION_TTL_HOURS);

  console.log(`[SessionStore] Restoring session ${session.id}. Old expiresAt: ${session.expiresAt}, New expiresAt: ${newExpiresAt}`);

  const updatedSession = await prisma.gameSession.update({
    where: { id: session.id },
    data: { expiresAt: newExpiresAt },
  });

  console.log(`[SessionStore] Session ${session.id} restored with new expiresAt: ${updatedSession.expiresAt}`);
  return dbToRecord(updatedSession);
}

// New function for clearing user sessions on logout
export async function clearUserSessions(userAddress: string): Promise<number> {
  if (!databaseAvailable) {
    const normalized = userAddress.toLowerCase();
    let cleared = 0;
    for (const [id, record] of inMemorySessions.entries()) {
      if (record.userAddress?.toLowerCase() === normalized) {
        inMemorySessions.delete(id);
        cleared += 1;
      }
    }
    return cleared;
  }

  try {
    const result = await prisma.gameSession.updateMany({
      where: { userAddress, isActive: true },
      data: { isActive: false },
    });
    return result.count;
  } catch (error) {
    markDatabaseUnavailable(error);
    return clearUserSessions(userAddress);
  }
}
