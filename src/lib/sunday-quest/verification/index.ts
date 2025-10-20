import { queryPonder } from "@/lib/indexer/client";

export interface VerificationResult {
  success: boolean;
  progress?: number; // 0-100
  message?: string;
  metadata?: Record<string, any>;
}

/**
 * Verify ETH transfer quest using Ponder xp_event table
 */
export async function verifyETHTransfer(
  userAddress: string,
  requirements: any,
  weekStartTimestamp: number
): Promise<VerificationResult> {
  const { minTransactions = 1, minAmount } = requirements;

  try {
    // Query XP events from this week (proxy for transactions)
    const sql = `
      SELECT COUNT(*) as count
      FROM xp_event
      WHERE user_address = $1
      AND timestamp >= $2
    `;

    const results = await queryPonder(sql, [
      userAddress.toLowerCase(),
      BigInt(weekStartTimestamp),
    ]);

    const transactionCount = parseInt(results[0]?.count || "0");
    const progress = Math.min(
      100,
      Math.floor((transactionCount / minTransactions) * 100)
    );

    return {
      success: transactionCount >= minTransactions,
      progress,
      message: `${transactionCount}/${minTransactions} transactions completed`,
      metadata: {
        transactionCount,
        required: minTransactions,
      },
    };
  } catch (error) {
    console.error("ETH transfer verification failed:", error);
    return {
      success: false,
      progress: 0,
      message: "Verification failed",
    };
  }
}

/**
 * Verify game session quest using Ponder user_stats table
 */
export async function verifyGameSessions(
  userAddress: string,
  requirements: any,
  weekStartTimestamp: number
): Promise<VerificationResult> {
  const { minGameSessions = 1, gameId } = requirements;

  try {
    // Query user stats
    const sql = `
      SELECT sessions_completed, games_played
      FROM user_stats
      WHERE id = $1
    `;

    const results = await queryPonder(sql, [userAddress.toLowerCase()]);

    if (!results || results.length === 0) {
      return {
        success: false,
        progress: 0,
        message: "No game sessions found",
        metadata: {
          sessionsCompleted: 0,
          required: minGameSessions,
        },
      };
    }

    const sessionsCompleted = parseInt(
      results[0]?.sessions_completed || "0"
    );
    const progress = Math.min(
      100,
      Math.floor((sessionsCompleted / minGameSessions) * 100)
    );

    return {
      success: sessionsCompleted >= minGameSessions,
      progress,
      message: `${sessionsCompleted}/${minGameSessions} sessions completed`,
      metadata: {
        sessionsCompleted,
        required: minGameSessions,
      },
    };
  } catch (error) {
    console.error("Game session verification failed:", error);
    return {
      success: false,
      progress: 0,
      message: "Verification failed",
    };
  }
}

/**
 * Verify vault deposit quest using Ponder wager table
 */
export async function verifyVaultDeposit(
  userAddress: string,
  requirements: any,
  weekStartTimestamp: number
): Promise<VerificationResult> {
  const { minWagerAmount = "0", targetContract } = requirements;

  try {
    // Query wagers from this week
    const sql = `
      SELECT SUM(wager_amount) as total_wagered, COUNT(*) as wager_count
      FROM wager
      WHERE user_address = $1
      AND timestamp >= $2
    `;

    const results = await queryPonder(sql, [
      userAddress.toLowerCase(),
      BigInt(weekStartTimestamp),
    ]);

    const totalWagered = BigInt(results[0]?.total_wagered || "0");
    const wagerCount = parseInt(results[0]?.wager_count || "0");
    const minAmount = BigInt(minWagerAmount);

    const progress =
      minAmount > 0n
        ? Math.min(100, Number((totalWagered * 100n) / minAmount))
        : wagerCount > 0
        ? 100
        : 0;

    return {
      success: totalWagered >= minAmount,
      progress,
      message: `Wagered ${totalWagered.toString()} / ${minAmount.toString()} wei`,
      metadata: {
        totalWagered: totalWagered.toString(),
        required: minAmount.toString(),
        wagerCount,
      },
    };
  } catch (error) {
    console.error("Vault deposit verification failed:", error);
    return {
      success: false,
      progress: 0,
      message: "Verification failed",
    };
  }
}

/**
 * Verify any transaction count quest using Ponder xp_event table
 */
export async function verifyTransactionCount(
  userAddress: string,
  requirements: any,
  weekStartTimestamp: number
): Promise<VerificationResult> {
  const { minTransactions = 1 } = requirements;

  try {
    // Count all XP events this week
    const sql = `
      SELECT COUNT(*) as count
      FROM xp_event
      WHERE user_address = $1
      AND timestamp >= $2
    `;

    const results = await queryPonder(sql, [
      userAddress.toLowerCase(),
      BigInt(weekStartTimestamp),
    ]);

    const transactionCount = parseInt(results[0]?.count || "0");
    const progress = Math.min(
      100,
      Math.floor((transactionCount / minTransactions) * 100)
    );

    return {
      success: transactionCount >= minTransactions,
      progress,
      message: `${transactionCount}/${minTransactions} transactions`,
      metadata: {
        transactionCount,
        required: minTransactions,
      },
    };
  } catch (error) {
    console.error("Transaction count verification failed:", error);
    return {
      success: false,
      progress: 0,
      message: "Verification failed",
    };
  }
}
