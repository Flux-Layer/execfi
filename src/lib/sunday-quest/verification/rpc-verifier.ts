import { Address, formatEther } from "viem";

// Alchemy SDK for efficient transaction fetching
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY || process.env.ALCHEMY_KEY;
// Use Base Mainnet for Sunday Quest verification (supports all mainnet chains)
const ALCHEMY_BASE_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

export interface TransactionVerificationResult {
  count: number;
  percentage: number;
  transactions: Array<{
    hash: string;
    value: string;
    timestamp: number;
  }>;
}

/**
 * Verify ETH transfers using Alchemy's getAssetTransfers API
 * This efficiently fetches all ETH transfers from/to a user
 */
export async function verifyETHTransfersViaRPC(
  userAddress: Address,
  startTimestamp: number,
  requiredCount: number,
  minAmountETH: number
): Promise<TransactionVerificationResult> {
  try {
    console.log(`\n🔍 [RPC Verifier] Starting verification...`);
    console.log(`👤 User: ${userAddress}`);
    console.log(`📅 Start timestamp: ${startTimestamp} (${new Date(startTimestamp * 1000).toISOString()})`);
    console.log(`💰 Min amount: ${minAmountETH} ETH`);
    console.log(`📊 Required count: ${requiredCount}`);

    // Convert timestamp to block number (approximate)
    const currentTime = Math.floor(Date.now() / 1000);
    const secondsAgo = currentTime - startTimestamp;
    
    // Use Alchemy's getAssetTransfers to fetch outgoing ETH transfers
    const response = await fetch(ALCHEMY_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [
          {
            fromAddress: userAddress,
            category: ["external"], // Native ETH transfers
            maxCount: "0x64", // 100 transfers max
            order: "desc", // Most recent first
          },
        ],
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("❌ [RPC Verifier] Alchemy API error:", data.error);
      return { count: 0, percentage: 0, transactions: [] };
    }

    const transfers = data.result?.transfers || [];
    console.log(`✅ [RPC Verifier] Alchemy returned ${transfers.length} total transfers`);

    // Filter transfers that meet criteria
    const validTransactions: Array<{
      hash: string;
      value: string;
      timestamp: number;
    }> = [];

    for (const transfer of transfers) {
      // Get block timestamp
      const blockResponse = await fetch(ALCHEMY_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getBlockByNumber",
          params: [transfer.blockNum, false],
        }),
      });

      const blockData = await blockResponse.json();
      const blockTimestamp = parseInt(blockData.result?.timestamp, 16);

      // Check if transfer meets criteria
      const value = parseFloat(transfer.value || "0");
      
      console.log(`  📝 Checking transfer ${transfer.hash.substring(0, 20)}...`);
      console.log(`     Value: ${value} ETH (min: ${minAmountETH})`);
      console.log(`     Time: ${new Date(blockTimestamp * 1000).toISOString()} (min: ${new Date(startTimestamp * 1000).toISOString()})`);
      console.log(`     Passes time check: ${blockTimestamp >= startTimestamp}`);
      console.log(`     Passes amount check: ${value >= minAmountETH}`);
      
      if (blockTimestamp >= startTimestamp && value >= minAmountETH) {
        validTransactions.push({
          hash: transfer.hash,
          value: value.toString(),
          timestamp: blockTimestamp,
        });

        console.log(`     ✅ VALID!`);
      } else {
        console.log(`     ❌ Rejected`);
      }
    }

    const count = validTransactions.length;
    const percentage = Math.min(100, Math.floor((count / requiredCount) * 100));

    console.log(`📊 Result: ${count}/${requiredCount} valid transfers (${percentage}%)`);

    return {
      count,
      percentage,
      transactions: validTransactions,
    };

  } catch (error) {
    console.error("RPC verification failed:", error);
    return {
      count: 0,
      percentage: 0,
      transactions: [],
    };
  }
}

/**
 * Verify swap transactions using Alchemy's getAssetTransfers API
 * Detects token swaps by looking for ERC20 transfers
 */
export async function verifySwapsViaRPC(
  userAddress: Address,
  startTimestamp: number,
  requiredCount: number
): Promise<TransactionVerificationResult> {
  try {
    console.log(`\n🔍 [Swap Verifier] Starting verification...`);
    console.log(`👤 User: ${userAddress}`);
    console.log(`📅 Start timestamp: ${startTimestamp}`);
    console.log(`📊 Required swaps: ${requiredCount}`);

    // Fetch ALL transfers (ERC20 + native ETH) to detect swaps
    // This catches both ERC20 → ERC20 swaps AND ETH → ERC20 swaps
    const [sentERC20Response, receivedERC20Response, sentETHResponse] = await Promise.all([
      fetch(ALCHEMY_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_getAssetTransfers",
          params: [
            {
              fromAddress: userAddress,
              category: ["erc20"],
              maxCount: "0x64",
              order: "desc",
            },
          ],
        }),
      }),
      fetch(ALCHEMY_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "alchemy_getAssetTransfers",
          params: [
            {
              toAddress: userAddress,
              category: ["erc20"],
              maxCount: "0x64",
              order: "desc",
            },
          ],
        }),
      }),
      // Also check for native ETH transfers (for ETH → Token swaps)
      fetch(ALCHEMY_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "alchemy_getAssetTransfers",
          params: [
            {
              fromAddress: userAddress,
              category: ["external"], // Native ETH transfers
              maxCount: "0x64",
              order: "desc",
            },
          ],
        }),
      }),
    ]);

    const sentERC20Data = await sentERC20Response.json();
    const receivedERC20Data = await receivedERC20Response.json();
    const sentETHData = await sentETHResponse.json();

    const sentERC20Transfers = sentERC20Data.result?.transfers || [];
    const receivedERC20Transfers = receivedERC20Data.result?.transfers || [];
    const sentETHTransfers = sentETHData.result?.transfers || [];

    // Combine all sent transfers (ERC20 + ETH)
    const allSentTransfers = [...sentERC20Transfers, ...sentETHTransfers];
    
    console.log(`✅ [Swap Verifier] Found ${sentERC20Transfers.length} ERC20 sent, ${sentETHTransfers.length} ETH sent, ${receivedERC20Transfers.length} ERC20 received`);

    // Group by transaction hash to detect swaps
    const txHashMap = new Map<string, { sent: any[], received: any[], blockNum: string }>();

    for (const transfer of allSentTransfers) {
      if (!txHashMap.has(transfer.hash)) {
        txHashMap.set(transfer.hash, { sent: [], received: [], blockNum: transfer.blockNum });
      }
      txHashMap.get(transfer.hash)!.sent.push(transfer);
    }

    for (const transfer of receivedERC20Transfers) {
      if (!txHashMap.has(transfer.hash)) {
        txHashMap.set(transfer.hash, { sent: [], received: [], blockNum: transfer.blockNum });
      }
      txHashMap.get(transfer.hash)!.received.push(transfer);
    }

    // Check for swaps - look for transactions with both sent and received tokens
    // OR fall back to counting any ERC20 transfers as potential swap activity
    const validSwaps: Array<{
      hash: string;
      value: string;
      timestamp: number;
    }> = [];

    // First, try to find perfect swaps (sent + received in same tx)
    const perfectSwaps = new Set<string>();
    for (const [hash, data] of txHashMap.entries()) {
      if (data.sent.length > 0 && data.received.length > 0) {
        perfectSwaps.add(hash);
      }
    }

    console.log(`  🔄 Perfect swaps (sent+received in same tx): ${perfectSwaps.size}`);

    // If no perfect swaps found, be more lenient:
    // Count any token transfer FROM user as potential swap activity
    const swapCandidates = perfectSwaps.size > 0 
      ? Array.from(perfectSwaps)
      : allSentTransfers.map((t: any) => t.hash);

    console.log(`  📊 Swap candidates to check: ${swapCandidates.length}`);

    for (const hash of swapCandidates) {
      const data = txHashMap.get(hash);
      if (!data) continue;

      // Get block timestamp
      const blockResponse = await fetch(ALCHEMY_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getBlockByNumber",
          params: [data.blockNum, false],
        }),
      });

      const blockData = await blockResponse.json();
      const blockTimestamp = parseInt(blockData.result?.timestamp, 16);

      if (blockTimestamp >= startTimestamp) {
        const sentToken = data.sent[0]?.asset || "UNKNOWN";
        const receivedToken = data.received[0]?.asset || "UNKNOWN";
        
        const swapDescription = data.received.length > 0
          ? `${sentToken} → ${receivedToken}`
          : sentToken;
        
        validSwaps.push({
          hash,
          value: swapDescription,
          timestamp: blockTimestamp,
        });

        console.log(`  ✅ Swap detected: ${hash} (${swapDescription})`);
      }
    }

    const count = validSwaps.length;
    const percentage = Math.min(100, Math.floor((count / requiredCount) * 100));

    console.log(`📊 Result: ${count}/${requiredCount} valid swaps (${percentage}%)`);

    return {
      count,
      percentage,
      transactions: validSwaps,
    };

  } catch (error) {
    console.error("Swap verification failed:", error);
    return {
      count: 0,
      percentage: 0,
      transactions: [],
    };
  }
}

/**
 * Verify general transaction count using Alchemy
 * Counts all transactions sent by the user
 */
export async function verifyTransactionCountViaRPC(
  userAddress: Address,
  startTimestamp: number,
  requiredCount: number
): Promise<TransactionVerificationResult> {
  try {
    console.log(`\n🔍 [Transaction Count Verifier] Starting verification...`);
    console.log(`👤 User: ${userAddress}`);
    console.log(`📅 Start timestamp: ${startTimestamp}`);
    console.log(`📊 Required transactions: ${requiredCount}`);

    // Use Alchemy to get all asset transfers (covers most transaction types)
    const categories = ["external", "erc20", "erc721", "erc1155"];
    const allTransactions = new Map<string, { hash: string; timestamp: number }>();

    for (const category of categories) {
      const response = await fetch(ALCHEMY_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_getAssetTransfers",
          params: [
            {
              fromAddress: userAddress,
              category: [category],
              maxCount: "0x64",
              order: "desc",
            },
          ],
        }),
      });

      const data = await response.json();
      const transfers = data.result?.transfers || [];

      for (const transfer of transfers) {
        if (!allTransactions.has(transfer.hash)) {
          // Get block timestamp
          const blockResponse = await fetch(ALCHEMY_BASE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "eth_getBlockByNumber",
              params: [transfer.blockNum, false],
            }),
          });

          const blockData = await blockResponse.json();
          const blockTimestamp = parseInt(blockData.result?.timestamp, 16);

          if (blockTimestamp >= startTimestamp) {
            allTransactions.set(transfer.hash, {
              hash: transfer.hash,
              timestamp: blockTimestamp,
            });
          }
        }
      }
    }

    const validTransactions = Array.from(allTransactions.values()).map(tx => ({
      hash: tx.hash,
      value: "transaction",
      timestamp: tx.timestamp,
    }));

    const count = validTransactions.length;
    const percentage = Math.min(100, Math.floor((count / requiredCount) * 100));

    console.log(`✅ [Transaction Count Verifier] Found ${count} transactions`);
    console.log(`📊 Result: ${count}/${requiredCount} transactions (${percentage}%)`);

    return {
      count,
      percentage,
      transactions: validTransactions,
    };

  } catch (error) {
    console.error("Transaction count verification failed:", error);
    return {
      count: 0,
      percentage: 0,
      transactions: [],
    };
  }
}

/**
 * Verify gas optimization quest
 * Finds transactions with gas used below the threshold
 */
export async function verifyGasOptimizationViaRPC(
  userAddress: Address,
  startTimestamp: number,
  requiredCount: number,
  maxGasUsed: number
): Promise<TransactionVerificationResult> {
  try {
    console.log(`\n🔍 [Gas Optimizer Verifier] Starting verification...`);
    console.log(`👤 User: ${userAddress}`);
    console.log(`📅 Start timestamp: ${startTimestamp}`);
    console.log(`⛽ Max gas: ${maxGasUsed}`);
    console.log(`📊 Required count: ${requiredCount}`);

    // Get all transactions from user
    const categories = ["external", "erc20", "erc721", "erc1155"];
    const allTransactionHashes = new Set<string>();

    for (const category of categories) {
      const response = await fetch(ALCHEMY_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_getAssetTransfers",
          params: [
            {
              fromAddress: userAddress,
              category: [category],
              maxCount: "0x64",
              order: "desc",
            },
          ],
        }),
      });

      const data = await response.json();
      const transfers = data.result?.transfers || [];

      for (const transfer of transfers) {
        allTransactionHashes.add(transfer.hash);
      }
    }

    console.log(`✅ Found ${allTransactionHashes.size} unique transactions`);

    // Check gas used for each transaction
    const validTransactions: Array<{
      hash: string;
      value: string;
      timestamp: number;
    }> = [];

    for (const hash of allTransactionHashes) {
      try {
        // Get transaction receipt for gas used
        const receiptResponse = await fetch(ALCHEMY_BASE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getTransactionReceipt",
            params: [hash],
          }),
        });

        const receiptData = await receiptResponse.json();
        const receipt = receiptData.result;

        if (!receipt) continue;

        const gasUsed = parseInt(receipt.gasUsed, 16);

        // Get block timestamp
        const blockResponse = await fetch(ALCHEMY_BASE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getBlockByNumber",
            params: [receipt.blockNumber, false],
          }),
        });

        const blockData = await blockResponse.json();
        const blockTimestamp = parseInt(blockData.result?.timestamp, 16);

        if (blockTimestamp >= startTimestamp && gasUsed <= maxGasUsed) {
          validTransactions.push({
            hash,
            value: `${gasUsed} gas`,
            timestamp: blockTimestamp,
          });

          console.log(`  ✅ Optimized tx: ${hash} (${gasUsed} gas)`);
        }
      } catch (error) {
        console.error(`Failed to check gas for ${hash}:`, error);
      }
    }

    const count = validTransactions.length;
    const percentage = Math.min(100, Math.floor((count / requiredCount) * 100));

    console.log(`📊 Result: ${count}/${requiredCount} optimized transactions (${percentage}%)`);

    return {
      count,
      percentage,
      transactions: validTransactions,
    };

  } catch (error) {
    console.error("Gas optimization verification failed:", error);
    return {
      count: 0,
      percentage: 0,
      transactions: [],
    };
  }
}

/**
 * TEMPORARY WORKAROUND: Use transaction hash verification
 * User can manually provide transaction hashes to verify
 * NOTE: Not currently used, but kept for future reference
 */
export async function verifyTransactionHashes(
  userAddress: Address,
  transactionHashes: string[],
  startTimestamp: number,
  minAmountETH: number
): Promise<TransactionVerificationResult> {
  const validTransactions: Array<{
    hash: string;
    value: string;
    timestamp: number;
  }> = [];

  for (const hash of transactionHashes) {
    try {
      // Fetch transaction via Alchemy
      const response = await fetch(ALCHEMY_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getTransactionByHash",
          params: [hash],
        }),
      });

      const data = await response.json();
      const tx = data.result;

      if (!tx) continue;

      // Get block details
      const blockResponse = await fetch(ALCHEMY_BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getBlockByNumber",
          params: [tx.blockNumber, false],
        }),
      });

      const blockData = await blockResponse.json();
      const blockTimestamp = parseInt(blockData.result?.timestamp, 16);
      const value = parseInt(tx.value, 16) / 1e18;

      // Check if transaction meets criteria
      if (
        tx.from.toLowerCase() === userAddress.toLowerCase() &&
        blockTimestamp >= startTimestamp &&
        value >= minAmountETH
      ) {
        validTransactions.push({
          hash: tx.hash,
          value: value.toString(),
          timestamp: blockTimestamp,
        });
      }
    } catch (error) {
      console.error(`Failed to verify tx ${hash}:`, error);
    }
  }

  return {
    count: validTransactions.length,
    percentage: 0,
    transactions: validTransactions,
  };
}
