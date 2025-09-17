// lib/idempotency.ts - In-memory idempotency guard against duplicate sends

import { createHash } from "crypto";
import type { NormalizedIntent } from "./normalize";

export class IdempotencyError extends Error {
  constructor(
    message: string,
    public code: string,
    public existingTxHash?: string,
  ) {
    super(message);
    this.name = "IdempotencyError";
  }
}

/**
 * Idempotency entry stored in memory
 */
interface IdempotencyEntry {
  promptId: string;
  userId: string;
  norm: NormalizedIntent;
  txHash?: string;
  status: "pending" | "completed" | "failed";
  timestamp: number;
  expiresAt: number;
}

/**
 * In-memory store for idempotency keys
 * In production, this should be replaced with Redis or database
 */
const idempotencyStore = new Map<string, IdempotencyEntry>();

/**
 * Configuration
 */
const CONFIG = {
  // Time window for duplicate detection (60 seconds)
  WINDOW_MS: 60 * 1000,

  // Cleanup interval (5 minutes)
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000,

  // Max entries to keep in memory
  MAX_ENTRIES: 10000,
};

/**
 * Generate idempotency key from user + transaction details + time bucket
 */
export function generateIdempotencyKey(
  userId: string,
  norm: NormalizedIntent,
  timeBucketMs = CONFIG.WINDOW_MS,
): string {
  // Create time bucket to group requests within the window
  const timeBucket = Math.floor(Date.now() / timeBucketMs);

  // Create hash input from transaction details
  const hashInput = JSON.stringify({
    userId,
    kind: norm.kind,
    chainId: norm.chainId,
    to: norm.to.toLowerCase(),
    amountWei: norm.amountWei.toString(),
    token: norm.kind === "erc20-transfer" ? norm.token.address.toLowerCase() : "native",
    timeBucket,
  });

  // Generate deterministic hash
  return createHash("sha256").update(hashInput).digest("hex").slice(0, 16);
}

/**
 * Check if a request is a duplicate within the time window
 */
export function checkDuplicate(promptId: string): IdempotencyEntry | null {
  const entry = idempotencyStore.get(promptId);

  if (!entry) {
    return null;
  }

  // Check if entry has expired
  if (Date.now() > entry.expiresAt) {
    idempotencyStore.delete(promptId);
    return null;
  }

  return entry;
}

/**
 * Register a new transaction attempt
 */
export function registerTransaction(
  promptId: string,
  userId: string,
  norm: NormalizedIntent,
): void {
  const now = Date.now();

  const entry: IdempotencyEntry = {
    promptId,
    userId,
    norm,
    status: "pending",
    timestamp: now,
    expiresAt: now + CONFIG.WINDOW_MS,
  };

  idempotencyStore.set(promptId, entry);

  // Trigger cleanup if store is getting large
  if (idempotencyStore.size > CONFIG.MAX_ENTRIES) {
    cleanupExpiredEntries();
  }
}

/**
 * Update transaction status with result
 */
export function updateTransactionStatus(
  promptId: string,
  status: "completed" | "failed",
  txHash?: string,
): void {
  const entry = idempotencyStore.get(promptId);

  if (entry) {
    entry.status = status;
    if (txHash) {
      entry.txHash = txHash;
    }
    idempotencyStore.set(promptId, entry);
  }
}

/**
 * Clean up expired entries from memory
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, entry] of idempotencyStore.entries()) {
    if (now > entry.expiresAt) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => idempotencyStore.delete(key));

  console.log(`Cleaned up ${keysToDelete.length} expired idempotency entries`);
}

/**
 * Guard function to check and prevent duplicate transactions
 */
export function guardAgainstDuplicate(
  userId: string,
  norm: NormalizedIntent,
): { promptId: string; isDuplicate: boolean; existingEntry?: IdempotencyEntry } {
  const promptId = generateIdempotencyKey(userId, norm);
  const existingEntry = checkDuplicate(promptId);

  if (existingEntry) {
    return {
      promptId,
      isDuplicate: true,
      existingEntry,
    };
  }

  // Register this new transaction attempt
  registerTransaction(promptId, userId, norm);

  return {
    promptId,
    isDuplicate: false,
  };
}

/**
 * Validate no duplicate transaction is in progress
 */
export function validateNoDuplicate(
  userId: string,
  norm: NormalizedIntent,
): string {
  const result = guardAgainstDuplicate(userId, norm);

  if (result.isDuplicate && result.existingEntry) {
    const entry = result.existingEntry;
    const timeAgo = Math.round((Date.now() - entry.timestamp) / 1000);

    switch (entry.status) {
      case "pending":
        throw new IdempotencyError(
          `Similar transaction already in progress (${timeAgo}s ago). Please wait.`,
          "DUPLICATE_PENDING"
        );

      case "completed":
        if (entry.txHash) {
          throw new IdempotencyError(
            `Identical transaction already completed (${timeAgo}s ago)`,
            "DUPLICATE_COMPLETED",
            entry.txHash
          );
        } else {
          throw new IdempotencyError(
            `Similar transaction already completed (${timeAgo}s ago)`,
            "DUPLICATE_COMPLETED"
          );
        }

      case "failed":
        // Allow retry of failed transactions after a short delay
        if (timeAgo < 10) {
          throw new IdempotencyError(
            `Similar transaction failed recently (${timeAgo}s ago). Please wait before retrying.`,
            "DUPLICATE_FAILED_RECENT"
          );
        }
        // If enough time has passed, allow the retry
        break;
    }
  }

  return result.promptId;
}

/**
 * Get store statistics (for debugging)
 */
export function getStoreStats(): {
  totalEntries: number;
  pendingTransactions: number;
  completedTransactions: number;
  failedTransactions: number;
} {
  let pending = 0;
  let completed = 0;
  let failed = 0;

  for (const entry of idempotencyStore.values()) {
    switch (entry.status) {
      case "pending":
        pending++;
        break;
      case "completed":
        completed++;
        break;
      case "failed":
        failed++;
        break;
    }
  }

  return {
    totalEntries: idempotencyStore.size,
    pendingTransactions: pending,
    completedTransactions: completed,
    failedTransactions: failed,
  };
}

// Set up periodic cleanup
if (typeof window === "undefined") {
  // Only run cleanup on server side
  setInterval(cleanupExpiredEntries, CONFIG.CLEANUP_INTERVAL_MS);
}