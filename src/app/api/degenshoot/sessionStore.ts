import crypto from "crypto";
import type { RowFairnessMeta } from "@/lib/games/bomb/fairness";

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
};

export type StoredRow = RowFairnessMeta & {
  selectedColumn: number | null;
  crashed: boolean;
  isCompleted: boolean;
};

const globalSessionStore =
  (globalThis as unknown as { __DEGENSHOOT_SESSION_STORE__?: Map<string, DegenshootSessionRecord> })
    .__DEGENSHOOT_SESSION_STORE__ ?? new Map<string, DegenshootSessionRecord>();

if (
  !(globalThis as unknown as {
    __DEGENSHOOT_SESSION_STORE__?: Map<string, DegenshootSessionRecord>;
  }).__DEGENSHOOT_SESSION_STORE__
) {
  (globalThis as unknown as {
    __DEGENSHOOT_SESSION_STORE__?: Map<string, DegenshootSessionRecord>;
  }).__DEGENSHOOT_SESSION_STORE__ = globalSessionStore;
}

const SESSION_STORE = globalSessionStore;

function randomSessionId(): string {
  // 64-bit unsigned integer represented as decimal string
  const buffer = crypto.randomBytes(8);
  const value = buffer.readBigUInt64BE(0);
  return value.toString();
}

function randomHex(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function createSessionRecord(
  overrides: Partial<DegenshootSessionRecord> = {},
): DegenshootSessionRecord {
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

  SESSION_STORE.set(record.id, record);
  return record;
}

export function getSessionRecord(
  id: string,
): DegenshootSessionRecord | undefined {
  return SESSION_STORE.get(id);
}

export function updateSessionRecord(
  id: string,
  updates: Partial<DegenshootSessionRecord>,
): DegenshootSessionRecord | undefined {
  const current = SESSION_STORE.get(id);
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
  SESSION_STORE.set(id, next);
  return next;
}

export function removeSessionRecord(id: string): void {
  SESSION_STORE.delete(id);
}

export function pruneExpiredSessions(ttlMs = 15 * 60 * 1000): void {
  const now = Date.now();
  for (const [id, record] of SESSION_STORE.entries()) {
    if (now - record.createdAt > ttlMs) {
      SESSION_STORE.delete(id);
    }
  }
}
