// Transaction management commands for ExecFi CLI (Phase 2)
import type { CommandDef } from "./types";
import { parseFlags } from "./parser";
import { getChainDisplayName } from "@/lib/chains/registry";

/**
 * Transaction details command - show detailed information for a specific tx
 */
export const txCmd: CommandDef = {
  name: "/tx",
  aliases: ["/transaction", "/txn"],
  category: "core",
  summary: "Show transaction details",
  usage: "/tx <hash> [--chain <id|name>]",
  flags: [
    {
      name: "chain",
      alias: "c",
      type: "string",
      description: "Override chain for this query (auto-detected if not provided)",
    },
  ],
  examples: [
    "/tx 0x1234567890abcdef...",
    "/tx 0xabcd... --chain base",
    "/transaction 0x1234...",
  ],
  parse: (line) => {
    try {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) {
        return { ok: false, error: "Missing transaction hash. Usage: /tx <hash>" };
      }

      const txHash = parts[1];
      if (!txHash.startsWith("0x") || txHash.length !== 66) {
        return { ok: false, error: "Invalid transaction hash format. Expected 0x followed by 64 hex characters." };
      }

      const flags = parseFlags(line.substring(line.indexOf(txHash) + txHash.length), txCmd.flags);
      return { ok: true, args: { ...flags, hash: txHash } };
    } catch (error) {
      return { ok: false, error: `Parse error: ${error}` };
    }
  },
  run: async (args, ctx, dispatch) => {
    const txHash = args.hash;
    const targetChain = args.chain || ctx.chainId || 8453;
    const chainName = getChainDisplayName(targetChain);

    // Show loading message
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `🔄 Fetching transaction details for ${txHash.slice(0, 10)}...${txHash.slice(-8)} on ${chainName}...`,
        timestamp: Date.now(),
      },
    });

    try {
      // Fetch transaction details (mock implementation)
      const txDetails = await fetchTransactionDetails(txHash, targetChain);

      const detailsText = formatTransactionDetails(txDetails, chainName, targetChain);

      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: detailsText,
          timestamp: Date.now(),
        },
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ Failed to fetch transaction: ${errorMessage}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};

/**
 * Transaction history command - show recent transactions
 */
export const txsCmd: CommandDef = {
  name: "/txs",
  aliases: ["/transactions", "/history"],
  category: "core",
  summary: "Show transaction history",
  usage: "/txs [--limit <n>] [--chain <id|name>] [--type <filter>]",
  flags: [
    {
      name: "limit",
      alias: "l",
      type: "number",
      default: 10,
      description: "Maximum number of transactions to show",
    },
    {
      name: "chain",
      alias: "c",
      type: "string",
      description: "Filter by specific chain",
    },
    {
      name: "type",
      alias: "t",
      type: "string",
      description: "Filter by type: send, receive, swap, all (default: all)",
    },
  ],
  examples: [
    "/txs",
    "/txs --limit 5",
    "/txs --chain base",
    "/txs --type send",
    "/history -l 3 -t receive",
  ],
  parse: (line) => {
    try {
      const flags = parseFlags(line, txsCmd.flags);
      return { ok: true, args: flags };
    } catch (error) {
      return { ok: false, error: `Parse error: ${error}` };
    }
  },
  run: async (args, ctx, dispatch) => {
    const limit = args.limit || 10;
    const targetChain = args.chain || ctx.chainId || 8453;
    const chainName = getChainDisplayName(targetChain);
    const typeFilter = args.type || "all";

    // Get the user's address
    const address =
      ctx.accountMode === "SMART_ACCOUNT"
        ? ctx.saAddress
        : ctx.selectedWallet?.address;

    if (!address) {
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ No wallet address available. Please connect a wallet first.`,
          timestamp: Date.now(),
        },
      });
      return;
    }

    // Show loading message
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `🔄 Fetching transaction history for ${address.slice(0, 6)}...${address.slice(-4)} on ${chainName}...`,
        timestamp: Date.now(),
      },
    });

    try {
      // Fetch transaction history (mock implementation)
      const transactions = await fetchTransactionHistory(address, targetChain, limit, typeFilter);

      const historyText = formatTransactionHistory(
        transactions,
        address,
        chainName,
        targetChain,
        typeFilter
      );

      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: historyText,
          timestamp: Date.now(),
        },
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ Failed to fetch transaction history: ${errorMessage}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};

/**
 * Pending operations command - show pending transactions and operations
 */
export const pendingCmd: CommandDef = {
  name: "/pending",
  aliases: ["/queue", "/waiting"],
  category: "core",
  summary: "Show pending transactions and operations",
  usage: "/pending [--chain <id|name>] [--all]",
  flags: [
    {
      name: "chain",
      alias: "c",
      type: "string",
      description: "Filter by specific chain",
    },
    {
      name: "all",
      alias: "a",
      type: "boolean",
      default: false,
      description: "Show all pending operations across chains",
    },
  ],
  examples: [
    "/pending",
    "/pending --chain base",
    "/pending --all",
    "/queue -a",
  ],
  parse: (line) => {
    try {
      const flags = parseFlags(line, pendingCmd.flags);
      return { ok: true, args: flags };
    } catch (error) {
      return { ok: false, error: `Parse error: ${error}` };
    }
  },
  run: async (args, ctx, dispatch) => {
    const targetChain = args.chain || ctx.chainId || 8453;
    const chainName = getChainDisplayName(targetChain);
    const showAll = args.all || false;

    // Get the user's address
    const address =
      ctx.accountMode === "SMART_ACCOUNT"
        ? ctx.saAddress
        : ctx.selectedWallet?.address;

    if (!address) {
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ No wallet address available. Please connect a wallet first.`,
          timestamp: Date.now(),
        },
      });
      return;
    }

    try {
      // Fetch pending operations (mock implementation)
      const pendingOps = await fetchPendingOperations(address, showAll ? undefined : targetChain);

      const pendingText = formatPendingOperations(
        pendingOps,
        address,
        showAll ? "All Chains" : chainName,
        showAll
      );

      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: pendingText,
          timestamp: Date.now(),
        },
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ Failed to fetch pending operations: ${errorMessage}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};

// Type definitions for transaction data
interface TransactionDetails {
  hash: string;
  status: "success" | "failed" | "pending";
  blockNumber?: number;
  timestamp?: number;
  from: string;
  to: string;
  value: string;
  gasUsed?: string;
  gasPrice?: string;
  fee?: string;
  type: "send" | "receive" | "swap" | "contract";
  method?: string;
}

interface PendingOperation {
  hash: string;
  type: "transaction" | "userOp" | "approval";
  status: "pending" | "confirming";
  timestamp: number;
  chainId: number;
  description: string;
  estimatedConfirmation?: number;
}

/**
 * Mock transaction details fetcher
 */
async function fetchTransactionDetails(hash: string, _chainId: number): Promise<TransactionDetails> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));

  // Mock transaction data
  return {
    hash,
    status: "success",
    blockNumber: 12345678,
    timestamp: Date.now() - 3600000, // 1 hour ago
    from: "0x850BCbdf06D0798B41414E65ceaf192AD763F88d",
    to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    value: "0.001",
    gasUsed: "21000",
    gasPrice: "0.000000020",
    fee: "0.00042",
    type: "send",
    method: "transfer",
  };
}

/**
 * Mock transaction history fetcher
 */
async function fetchTransactionHistory(
  _address: string,
  _chainId: number,
  _limit: number,
  _typeFilter: string
): Promise<TransactionDetails[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1200));

  // Mock transaction history
  const mockTxs: TransactionDetails[] = [];

  // Generate mock transactions (empty for now)
  return mockTxs;
}

/**
 * Mock pending operations fetcher
 */
async function fetchPendingOperations(_address: string, _chainId?: number): Promise<PendingOperation[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Mock pending operations (empty for clean wallet)
  return [];
}

/**
 * Format transaction details for display
 */
function formatTransactionDetails(tx: TransactionDetails, chainName: string, chainId: number): string {
  const statusIcon = tx.status === "success" ? "✅" : tx.status === "failed" ? "❌" : "⏳";
  const timeAgo = tx.timestamp ? formatTimeAgo(tx.timestamp) : "Unknown";
  const explorerUrl = getExplorerUrl(tx.hash, chainId);

  return `🔗 Transaction Details

**Hash:** ${tx.hash}
**Status:** ${statusIcon} ${tx.status.toUpperCase()}
**Chain:** ${chainName} (${chainId})
**Time:** ${timeAgo}

**Transaction Info:**
• From: ${tx.from.slice(0, 6)}...${tx.from.slice(-4)}
• To: ${tx.to.slice(0, 6)}...${tx.to.slice(-4)}
• Value: ${tx.value} ETH
• Type: ${tx.type}
${tx.method ? `• Method: ${tx.method}` : ""}

**Gas & Fees:**
${tx.gasUsed ? `• Gas Used: ${tx.gasUsed}` : ""}
${tx.gasPrice ? `• Gas Price: ${tx.gasPrice} ETH` : ""}
${tx.fee ? `• Total Fee: ${tx.fee} ETH` : ""}
${tx.blockNumber ? `• Block: #${tx.blockNumber.toLocaleString()}` : ""}

**Explorer:** ${explorerUrl}

💡 **Tips:**
• Use \`/txs\` to see your transaction history
• Use \`/pending\` to check for pending transactions`;
}

/**
 * Format transaction history for display
 */
function formatTransactionHistory(
  transactions: TransactionDetails[],
  address: string,
  chainName: string,
  chainId: number,
  typeFilter: string
): string {
  const header = `📜 Transaction History

**Account:** ${address.slice(0, 6)}...${address.slice(-4)}
**Chain:** ${chainName}${typeof chainId === 'number' ? ` (${chainId})` : ""}
**Filter:** ${typeFilter}
**Total:** ${transactions.length} transaction(s)

`;

  if (transactions.length === 0) {
    return header + `🚫 No transactions found

This could mean:
• Your wallet has no transaction history on this chain
• Transactions are still pending or not yet indexed
• You may need to check a different chain

💡 **Try:**
• \`/txs --chain ethereum\` to check other chains
• \`/pending\` to see any pending transactions
• \`/balance\` to verify your current balance`;
  }

  const txRows = transactions.map((tx, index) => {
    const statusIcon = tx.status === "success" ? "✅" : tx.status === "failed" ? "❌" : "⏳";
    const timeAgo = tx.timestamp ? formatTimeAgo(tx.timestamp) : "Unknown";
    const direction = tx.from.toLowerCase() === address.toLowerCase() ? "→" : "←";

    return `${index + 1}. ${statusIcon} ${direction} ${tx.value} ETH
   Hash: ${tx.hash.slice(0, 10)}...${tx.hash.slice(-8)}
   ${tx.from.toLowerCase() === address.toLowerCase() ? `To: ${tx.to.slice(0, 6)}...${tx.to.slice(-4)}` : `From: ${tx.from.slice(0, 6)}...${tx.from.slice(-4)}`}
   Time: ${timeAgo}`;
  }).join("\n\n");

  return header + txRows + `

💡 **Commands:**
• \`/tx <hash>\` for detailed transaction info
• \`/txs --type send\` to filter by transaction type
• \`/pending\` to check pending transactions`;
}

/**
 * Format pending operations for display
 */
function formatPendingOperations(
  operations: PendingOperation[],
  address: string,
  chainName: string,
  showAll: boolean
): string {
  const header = `⏳ Pending Operations

**Account:** ${address.slice(0, 6)}...${address.slice(-4)}
**Scope:** ${chainName}
**Total:** ${operations.length} pending operation(s)

`;

  if (operations.length === 0) {
    return header + `✅ No pending operations

Your account has no pending transactions or operations.

💡 **This means:**
• All recent transactions have been confirmed
• No pending approvals or user operations
• Your wallet is ready for new transactions

**Quick Actions:**
• \`/balance\` to check your current balance
• \`/txs\` to see recent transaction history
• \`/send <amount> <token> to <address>\` to start a new transaction`;
  }

  const opRows = operations.map((op, index) => {
    const timeAgo = formatTimeAgo(op.timestamp);
    const chain = showAll ? ` (Chain ${op.chainId})` : "";
    const eta = op.estimatedConfirmation ? ` - ETA: ${Math.ceil((op.estimatedConfirmation - Date.now()) / 60000)}m` : "";

    return `${index + 1}. **${op.type.toUpperCase()}** - ${op.status}${chain}
   Description: ${op.description}
   Hash: ${op.hash.slice(0, 10)}...${op.hash.slice(-8)}
   Started: ${timeAgo}${eta}`;
  }).join("\n\n");

  return header + opRows + `

💡 **Tips:**
• Pending transactions usually confirm within 1-5 minutes
• You can check individual transactions with \`/tx <hash>\`
• Use \`/txs\` to see completed transaction history`;
}

/**
 * Utility functions
 */
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function getExplorerUrl(hash: string, chainId: number): string {
  const explorers: Record<number, string> = {
    1: "https://etherscan.io",
    8453: "https://basescan.org",
    137: "https://polygonscan.com",
    42161: "https://arbiscan.io",
    10: "https://optimistic.etherscan.io",
  };

  const baseUrl = explorers[chainId] || "https://basescan.org";
  return `${baseUrl}/tx/${hash}`;
}