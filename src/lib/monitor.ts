// lib/monitor.ts - Transaction monitoring and status tracking

import {
  createPublicClient,
  http,
  type TransactionReceipt,
  type Hash,
} from "viem";
import {
  base, // base mainnet
  baseSepolia, // base testnet sepolia
  mainnet, // eth mainnet
  sepolia, // eth testnet sepolia
  polygon, // polygon mainnet
  polygonAmoy, // polygon testnet amoy
  arbitrum, // arbitrum mainnet
  arbitrumSepolia, // arbitrum testnet sepolia
  optimism, // optimism mainnet
  optimismSepolia, // optimism testnet sepolia
  avalanche, // avax mainnet
  avalancheFuji, // avax testnet fuji
  bsc, // bsc mainnet
  bscTestnet, // bsc testnet
  abstract, // abstract mainnet
  abstractTestnet, // asbtract testnet
  lisk, // lisk mainnet
  liskSepolia, // listk testnet sepolia
} from "viem/chains";

export class MonitoringError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "MonitoringError";
  }
}

export interface TransactionStatus {
  status: "pending" | "confirmed" | "failed";
  confirmations?: number;
  receipt?: TransactionReceipt;
  error?: string;
}

export interface MonitoringConfig {
  maxWaitTime: number; // Maximum time to wait (ms)
  pollInterval: number; // How often to check (ms)
  requiredConfirmations: number; // How many confirmations needed
}

/**
 * Default monitoring configuration
 */
const DEFAULT_CONFIG: MonitoringConfig = {
  maxWaitTime: 60 * 1000, // 60 seconds
  pollInterval: 5 * 1000, // 2 seconds
  requiredConfirmations: 1, // 1 confirmation for testnet
};

/**
 * Chain configuration for monitoring
 */
const CHAIN_CONFIG = {
  // Base Mainnet
  8453: {
    chain: base,
    rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  },
  // Base Sepolia
  84532: {
    chain: baseSepolia,
    rpcUrl: `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  },
  // Ethereum Mainnet
  1: {
    chain: mainnet,
    rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  },
  // Ethereum Sepolia
  11155111: {
    chain: sepolia,
    rpcUrl: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  },
  // Polygon
  137: {
    chain: polygon,
    rpcUrl: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  },
  // Arbitrum One
  42161: {
    chain: arbitrum,
    rpcUrl: `https://arb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  },
  // Optimism
  10: {
    chain: optimism,
    rpcUrl: `https://opt-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  },
  // Avalanche
  43114: {
    chain: avalanche,
    rpcUrl: `https://avalanche.publicnode.com`,
  },
  56: {
    chain: bsc,
    rpcUrl: bsc?.rpcUrls?.default?.http?.[0],
  },
  97: {
    chain: bscTestnet,
    rpcUrl: bscTestnet?.rpcUrls?.default?.http?.[0],
  },
  2741: {
    chain: abstract,
    rpcUrl: abstract?.rpcUrls?.default?.http?.[0],
  },
  11124: {
    chain: abstractTestnet,
    rpcUrl: abstractTestnet?.rpcUrls?.default?.http?.[0],
  },
};

/**
 * Create public client for transaction monitoring
 */
function getPublicClient(chainId: number) {
  const config = CHAIN_CONFIG[chainId as keyof typeof CHAIN_CONFIG];
  if (!config) {
    throw new MonitoringError(
      `Unsupported chainId for monitoring: ${chainId}`,
      "CHAIN_UNSUPPORTED",
    );
  }

  return createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
}

/**
 * Get transaction receipt
 */
async function getTransactionReceipt(
  chainId: number,
  txHash: Hash,
): Promise<TransactionReceipt | null> {
  const publicClient = getPublicClient(chainId);

  console.log({ publicClient });

  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    console.log({ receipt });
    return receipt as any;
  } catch (error: any) {
    // If transaction not found, return null (still pending)
    if (
      error?.message?.includes("not found") ||
      error?.cause?.code === -32000
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Get current block number
 */
async function getCurrentBlockNumber(chainId: number): Promise<bigint> {
  const publicClient = getPublicClient(chainId);
  return await publicClient.getBlockNumber();
}

/**
 * Check transaction status
 */
export async function checkTransactionStatus(
  chainId: number,
  txHash: Hash,
): Promise<TransactionStatus> {
  try {
    const receipt = await getTransactionReceipt(chainId, txHash);

    if (!receipt) {
      return { status: "pending" };
    }

    // Check if transaction succeeded or failed
    if (receipt.status === "success") {
      // Calculate confirmations
      const currentBlock = await getCurrentBlockNumber(chainId);
      const confirmations = Number(currentBlock - receipt.blockNumber) + 1;

      return {
        status: "confirmed",
        confirmations,
        receipt,
      };
    } else {
      return {
        status: "failed",
        receipt,
        error: "Transaction was reverted",
      };
    }
  } catch (error: any) {
    throw new MonitoringError(
      `Failed to check transaction status: ${error?.message || "Unknown error"}`,
      "STATUS_CHECK_FAILED",
    );
  }
}

/**
 * Monitor transaction until confirmed or timeout
 */
export async function monitorTransaction(
  chainId: number,
  txHash: Hash,
  config: Partial<MonitoringConfig> = {},
): Promise<TransactionStatus> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  console.log(`🔄 Monitoring transaction ${txHash} on chain ${chainId}...`);

  return new Promise((resolve, reject) => {
    const checkStatus = async () => {
      try {
        // Check if we've exceeded max wait time
        if (Date.now() - startTime > finalConfig.maxWaitTime) {
          resolve({
            status: "pending",
            error: "Transaction monitoring timeout - check explorer for status",
          });
          return;
        }

        const status = await checkTransactionStatus(chainId, txHash);

        // If transaction is still pending, continue monitoring
        if (status.status === "pending") {
          setTimeout(checkStatus, finalConfig.pollInterval);
          return;
        }

        // If transaction failed, resolve with failure
        if (status.status === "failed") {
          console.log(`❌ Transaction ${txHash} failed`);
          resolve(status);
          return;
        }

        // If transaction succeeded, check confirmations
        if (status.status === "confirmed") {
          const confirmations = status.confirmations || 0;

          if (confirmations >= finalConfig.requiredConfirmations) {
            console.log(
              `✅ Transaction ${txHash} confirmed with ${confirmations} confirmations`,
            );
            resolve(status);
          } else {
            console.log(
              `⏳ Transaction ${txHash} confirmed but waiting for more confirmations (${confirmations}/${finalConfig.requiredConfirmations})`,
            );
            setTimeout(checkStatus, finalConfig.pollInterval);
          }
          return;
        }
      } catch (error: any) {
        console.error("❌ Transaction monitoring error:", error);
        reject(
          new MonitoringError(
            `Transaction monitoring failed: ${error?.message || "Unknown error"}`,
            "MONITORING_FAILED",
          ),
        );
      }
    };

    // Start monitoring
    checkStatus();
  });
}

/**
 * Quick transaction confirmation check (no polling)
 */
export async function getTransactionConfirmation(
  chainId: number,
  txHash: Hash,
): Promise<{
  isConfirmed: boolean;
  confirmations: number;
  receipt?: TransactionReceipt;
}> {
  try {
    const receipt = await getTransactionReceipt(chainId, txHash);

    if (!receipt || receipt.status !== "success") {
      return { isConfirmed: false, confirmations: 0 };
    }

    const currentBlock = await getCurrentBlockNumber(chainId);
    const confirmations = Number(currentBlock - receipt.blockNumber) + 1;

    return {
      isConfirmed: true,
      confirmations,
      receipt,
    };
  } catch (error: any) {
    throw new MonitoringError(
      `Failed to get transaction confirmation: ${error?.message || "Unknown error"}`,
      "CONFIRMATION_CHECK_FAILED",
    );
  }
}

/**
 * Wait for specific number of confirmations
 */
export async function waitForConfirmations(
  chainId: number,
  txHash: Hash,
  requiredConfirmations: number = 1,
  timeout: number = 120000, // 2 minutes
): Promise<TransactionReceipt> {
  const result = await monitorTransaction(chainId, txHash, {
    requiredConfirmations,
    maxWaitTime: timeout,
  });

  if (result.status === "failed") {
    throw new MonitoringError(
      `Transaction failed: ${result.error || "Unknown error"}`,
      "TRANSACTION_FAILED",
    );
  }

  if (result.status === "pending") {
    throw new MonitoringError(
      `Transaction timeout: Still pending after ${timeout}ms`,
      "TRANSACTION_TIMEOUT",
    );
  }

  if (!result.receipt) {
    throw new MonitoringError(
      "Transaction confirmed but no receipt available",
      "NO_RECEIPT",
    );
  }

  return result.receipt;
}

/**
 * Format monitoring status for user display
 */
export function formatMonitoringStatus(status: TransactionStatus): string {
  switch (status.status) {
    case "pending":
      return "⏳ Transaction pending confirmation...";

    case "confirmed":
      const confirmations = status.confirmations || 0;
      return `✅ Transaction confirmed with ${confirmations} confirmation${confirmations === 1 ? "" : "s"}`;

    case "failed":
      return `❌ Transaction failed: ${status.error || "Unknown error"}`;

    default:
      return "❓ Unknown transaction status";
  }
}

/**
 * Get estimated confirmation time for chain
 */
export function getEstimatedConfirmationTime(chainId: number): number {
  switch (chainId) {
    // Base networks have ~2 second block times
    case 8453: // Base
    case 84532: // Base Sepolia
      return 2000; // 2 seconds

    // Ethereum networks have ~12 second block times
    case 1: // Ethereum Mainnet
    case 11155111: // Ethereum Sepolia
      return 12000; // 12 seconds

    // Polygon has ~2 second block times
    case 137: // Polygon
      return 2000; // 2 seconds

    // Arbitrum has ~0.25 second block times
    case 42161: // Arbitrum One
      return 250; // 0.25 seconds

    // Optimism has ~2 second block times
    case 10: // Optimism
      return 2000; // 2 seconds

    // Avalanche has ~2 second block times
    case 43114: // Avalanche
      return 2000; // 2 seconds

    // Default to Ethereum timing
    default:
      return 12000; // 12 seconds
  }
}
