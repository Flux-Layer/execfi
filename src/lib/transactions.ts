// lib/transactions.ts - Real transaction data fetching from blockchain

import {
  createPublicClient,
  http,
  type TransactionReceipt,
  type Transaction,
  formatEther,
  formatGwei,
} from "viem";
import {
  base,
  baseSepolia,
  mainnet,
  sepolia,
  polygon,
  arbitrum,
  optimism,
  avalanche,
  bsc,
  bscTestnet,
  abstract,
  abstractTestnet,
  lisk,
  liskSepolia,
} from "viem/chains";

export interface TransactionDetails {
  hash: string;
  status: "success" | "failed" | "pending";
  blockNumber?: bigint;
  timestamp?: number;
  from: string;
  to: string | null;
  value: bigint;
  gasUsed?: bigint;
  gasPrice?: bigint;
  effectiveGasPrice?: bigint;
  fee?: bigint;
  type: "send" | "receive" | "swap" | "contract";
  method?: string;
  data?: string;
  nonce?: number;
}

/**
 * Chain configuration for transaction fetching
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
  // Lisk Mainnet
  1135: {
    chain: lisk,
    rpcUrl: lisk?.rpcUrls?.default?.http?.[0],
  },
  // Lisk Sepolia
  4202: {
    chain: liskSepolia,
    rpcUrl: liskSepolia?.rpcUrls?.default?.http?.[0],
  },
};

/**
 * Create public client for transaction fetching
 */
function getPublicClient(chainId: number) {
  const config = CHAIN_CONFIG[chainId as keyof typeof CHAIN_CONFIG];
  if (!config) {
    throw new Error(`Unsupported chainId for transaction fetching: ${chainId}`);
  }

  return createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
}

/**
 * Determine transaction type based on transaction data
 */
function determineTransactionType(
  tx: any,
  receipt: TransactionReceipt | null
): "send" | "receive" | "swap" | "contract" {
  // Contract deployment
  if (!tx.to) {
    return "contract";
  }

  // Check if it's a simple ETH transfer (no data or just 0x)
  if (!tx.input || tx.input === "0x") {
    return "send";
  }

  // Check for common method signatures
  const methodSignature = tx.input.slice(0, 10);

  // ERC20 transfer: 0xa9059cbb
  if (methodSignature === "0xa9059cbb") {
    return "send";
  }

  // Swap-related methods (common DEX signatures)
  const swapSignatures = [
    "0x38ed1739", // swapExactTokensForTokens
    "0x8803dbee", // swapTokensForExactTokens
    "0x7ff36ab5", // swapExactETHForTokens
    "0x18cbafe5", // swapExactTokensForETH
    "0xfb3bdb41", // swapETHForExactTokens
    "0x4a25d94a", // swapTokensForExactETH
  ];

  if (swapSignatures.includes(methodSignature)) {
    return "swap";
  }

  // Default to contract interaction
  return "contract";
}

/**
 * Get method name from transaction input data
 */
function getMethodName(input: string): string | undefined {
  if (!input || input === "0x") {
    return "transfer";
  }

  const methodSignature = input.slice(0, 10);

  // Common method signatures
  const methodMap: Record<string, string> = {
    "0xa9059cbb": "transfer",
    "0x38ed1739": "swapExactTokensForTokens",
    "0x8803dbee": "swapTokensForExactTokens",
    "0x7ff36ab5": "swapExactETHForTokens",
    "0x18cbafe5": "swapExactTokensForETH",
    "0xfb3bdb41": "swapETHForExactTokens",
    "0x4a25d94a": "swapTokensForExactETH",
    "0x095ea7b3": "approve",
    "0x23b872dd": "transferFrom",
  };

  return methodMap[methodSignature] || "contract call";
}

/**
 * Fetch real transaction details from blockchain
 */
export async function fetchTransactionDetails(
  hash: `0x${string}`,
  chainId: number
): Promise<TransactionDetails> {
  const publicClient = getPublicClient(chainId);

  try {
    // Fetch transaction data
    const tx = await publicClient.getTransaction({ hash });

    // Try to fetch receipt (might not exist if pending)
    let receipt: TransactionReceipt | null = null;
    try {
      receipt = (await publicClient.getTransactionReceipt({ hash })) as TransactionReceipt;
    } catch (error: any) {
      // Transaction might be pending if receipt not found
      if (
        error?.message?.includes("not found") ||
        error?.message?.includes("could not be found")
      ) {
        // Transaction exists but no receipt yet - it's pending
        return {
          hash,
          status: "pending",
          from: tx.from,
          to: tx.to,
          value: tx.value,
          type: determineTransactionType(tx, null),
          method: getMethodName(tx.input),
          data: tx.input,
          nonce: tx.nonce,
        };
      }
      throw error;
    }

    // Calculate fee from receipt
    let fee: bigint | undefined;
    if (receipt) {
      const gasUsed = receipt.gasUsed;
      const effectiveGasPrice = receipt.effectiveGasPrice;
      fee = gasUsed * effectiveGasPrice;
    }

    // Get timestamp from block data if available
    let timestamp: number | undefined;
    if (receipt?.blockNumber) {
      try {
        const block = await publicClient.getBlock({
          blockNumber: receipt.blockNumber,
        });
        timestamp = Number(block.timestamp) * 1000; // Convert to milliseconds
      } catch (error) {
        // If we can't get block timestamp, it's okay to continue
        console.error("Failed to fetch block timestamp:", error);
      }
    }

    // Determine status
    const status = receipt?.status === "success" ? "success" : "failed";

    return {
      hash,
      status,
      blockNumber: receipt?.blockNumber,
      timestamp,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      gasUsed: receipt?.gasUsed,
      gasPrice: tx.gasPrice,
      effectiveGasPrice: receipt?.effectiveGasPrice,
      fee,
      type: determineTransactionType(tx, receipt),
      method: getMethodName(tx.input),
      data: tx.input,
      nonce: tx.nonce,
    };
  } catch (error: any) {
    // Handle transaction not found
    if (
      error?.message?.includes("not found") ||
      error?.message?.includes("could not be found")
    ) {
      throw new Error(
        `Transaction ${hash} not found on chain ${chainId}. Please verify the transaction hash and chain.`
      );
    }

    // Handle other errors
    throw new Error(
      `Failed to fetch transaction: ${error?.message || "Unknown error"}`
    );
  }
}

/**
 * Format transaction details for display (helper function)
 */
export function formatTransactionDetailsForDisplay(
  details: TransactionDetails,
  nativeCurrencySymbol: string = "ETH"
): {
  value: string;
  fee: string;
  gasUsed: string;
  gasPrice: string;
  effectiveGasPrice: string;
} {
  return {
    value: `${formatEther(details.value)} ${nativeCurrencySymbol}`,
    fee: details.fee ? `${formatEther(details.fee)} ${nativeCurrencySymbol}` : "N/A",
    gasUsed: details.gasUsed ? details.gasUsed.toString() : "N/A",
    gasPrice: details.gasPrice ? `${formatGwei(details.gasPrice)} Gwei` : "N/A",
    effectiveGasPrice: details.effectiveGasPrice
      ? `${formatGwei(details.effectiveGasPrice)} Gwei`
      : "N/A",
  };
}

/**
 * Blockscout API configuration for chains
 */
const BLOCKSCOUT_APIS: Record<number, string> = {
  1135: "https://blockscout.lisk.com/api/v2", // Lisk Mainnet
  4202: "https://sepolia-blockscout.lisk.com/api/v2", // Lisk Sepolia
  8453: "https://base.blockscout.com/api/v2", // Base Mainnet
  84532: "https://base-sepolia.blockscout.com/api/v2", // Base Sepolia
};

/**
 * Blockscout API transaction response type
 */
interface BlockscoutTransaction {
  hash: string;
  from: {
    hash: string;
  };
  to: {
    hash: string;
  } | null;
  value: string;
  timestamp: string;
  status: string;
  block_number: number;
  gas_used: string;
  gas_price: string;
  fee: {
    value: string;
  };
  type: number;
  method?: string;
}

/**
 * Fetch transaction history from Blockscout API
 */
async function fetchTransactionHistoryFromBlockscout(
  address: string,
  chainId: number,
  limit: number
): Promise<TransactionDetails[]> {
  const baseUrl = BLOCKSCOUT_APIS[chainId];
  if (!baseUrl) {
    throw new Error(
      `Blockscout API not available for chain ${chainId}. Transaction history is only supported for Lisk and Base chains.`
    );
  }

  try {
    const url = `${baseUrl}/addresses/${address}/transactions`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Blockscout API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const items: BlockscoutTransaction[] = data.items || [];

    // Convert Blockscout format to our TransactionDetails format
    const transactions: TransactionDetails[] = items.slice(0, limit).map((tx) => {
      // Safely convert to BigInt, handling null/undefined/empty strings
      const safeBigInt = (val: string | null | undefined): bigint => {
        if (!val || val === "" || val === "null" || val === "undefined") {
          return BigInt(0);
        }
        try {
          return BigInt(val);
        } catch {
          return BigInt(0);
        }
      };

      const value = safeBigInt(tx.value);
      const gasUsed = safeBigInt(tx.gas_used);
      const gasPrice = safeBigInt(tx.gas_price);
      const fee = safeBigInt(tx.fee?.value);

      return {
        hash: tx.hash,
        status: tx.status === "ok" ? "success" : tx.status === "error" ? "failed" : "pending",
        blockNumber: BigInt(tx.block_number || 0),
        timestamp: new Date(tx.timestamp).getTime(),
        from: tx.from.hash,
        to: tx.to?.hash || null,
        value,
        gasUsed,
        gasPrice,
        fee,
        type: "send", // We can improve this detection later
        method: tx.method || "transfer",
      };
    });

    return transactions;
  } catch (error: any) {
    throw new Error(
      `Failed to fetch transaction history: ${error?.message || "Unknown error"}`
    );
  }
}

/**
 * Fetch transaction history for an address
 * Currently supports chains with Blockscout API (Lisk, Base)
 * For other chains, returns empty array with helpful message
 */
export async function fetchTransactionHistory(
  address: `0x${string}`,
  chainId: number,
  limit: number = 10,
  typeFilter?: string
): Promise<TransactionDetails[]> {
  // Check if chain has Blockscout API support
  if (BLOCKSCOUT_APIS[chainId]) {
    const transactions = await fetchTransactionHistoryFromBlockscout(address, chainId, limit);

    // Apply type filter if specified
    if (typeFilter && typeFilter !== "all") {
      return transactions.filter((tx) => tx.type === typeFilter);
    }

    return transactions;
  }

  // For chains without Blockscout support, return empty array
  // In the future, we can add support for other APIs (Etherscan, Alchemy, etc.)
  return [];
}