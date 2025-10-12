// lib/activity/alchemy.ts - Alchemy Transfers API client for on-chain activity

import { Alchemy, Network, SortingOrder } from 'alchemy-sdk';
import type { AssetTransfersCategory, AssetTransfersResult } from 'alchemy-sdk';
import { getChainConfig } from '@/lib/chains/registry';
import type { OnChainActivity, TransactionType } from './types';

/**
 * Map chain IDs to Alchemy Network enum
 */
const NETWORK_MAP: Record<number, Network> = {
  // Ethereum
  1: Network.ETH_MAINNET,
  11155111: Network.ETH_SEPOLIA,
  
  // Base
  8453: Network.BASE_MAINNET,
  84532: Network.BASE_SEPOLIA,
  
  // Polygon
  137: Network.MATIC_MAINNET,
  80002: Network.MATIC_AMOY,
  
  // Arbitrum
  42161: Network.ARB_MAINNET,
  421614: Network.ARB_SEPOLIA,
  
  // Optimism
  10: Network.OPT_MAINNET,
  11155420: Network.OPT_SEPOLIA,
  
  // BSC
  56: Network.BNB_MAINNET,
  97: Network.BNB_TESTNET,
  
  // Abstract
  2741: Network.ABSTRACT_MAINNET,
  11124: Network.ABSTRACT_TESTNET,
};

/**
 * Check if a chain is supported by Alchemy
 */
export function isAlchemySupported(chainId: number): boolean {
  return chainId in NETWORK_MAP;
}

/**
 * Get list of all Alchemy-supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return Object.keys(NETWORK_MAP).map(Number);
}

/**
 * Initialize Alchemy client for a specific chain
 */
function getAlchemyClient(chainId: number): Alchemy {
  const network = NETWORK_MAP[chainId];
  if (!network) {
    throw new Error(`Alchemy doesn't support chain ${chainId}`);
  }

  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_ALCHEMY_KEY not configured');
  }

  return new Alchemy({
    apiKey,
    network,
  });
}

/**
 * Fetch asset transfers (transactions + token transfers) from Alchemy
 */
export async function fetchAlchemyActivity(
  chainId: number,
  address: `0x${string}`,
  options?: {
    fromBlock?: string;
    toBlock?: string;
    category?: AssetTransfersCategory[];
    maxCount?: number;
    pageKey?: string;
  }
): Promise<OnChainActivity[]> {
  if (!isAlchemySupported(chainId)) {
    throw new Error(`Chain ${chainId} not supported by Alchemy`);
  }

  const alchemy = getAlchemyClient(chainId);
  const chain = getChainConfig(chainId);
  if (!chain) {
    throw new Error(`Chain ${chainId} not configured`);
  }

  try {
    const maxCount = options?.maxCount || 50;
    const categories = options?.category || ([
      'external',  // Native token transfers (ETH, MATIC, etc.)
      'erc20',     // ERC-20 token transfers
      // Note: 'internal' category not supported on all chains (e.g., Base)
    ] as AssetTransfersCategory[]);

    // Fetch transfers FROM the address (sent)
    const sentPromise = alchemy.core.getAssetTransfers({
      fromAddress: address,
      category: categories,
      maxCount,
      order: SortingOrder.DESCENDING,
      withMetadata: true,
      excludeZeroValue: false,
    });

    // Fetch transfers TO the address (received)
    const receivedPromise = alchemy.core.getAssetTransfers({
      toAddress: address,
      category: categories,
      maxCount,
      order: SortingOrder.DESCENDING,
      withMetadata: true,
      excludeZeroValue: false,
    });

    // Fetch both in parallel
    const [sentResult, receivedResult] = await Promise.all([
      sentPromise,
      receivedPromise,
    ]);

    // Combine and deduplicate by transaction hash
    const allTransfers = [
      ...sentResult.transfers,
      ...receivedResult.transfers,
    ];

    const uniqueTransfers = Array.from(
      new Map(allTransfers.map(t => [t.hash, t])).values()
    );

    // Transform to OnChainActivity format
    const activities = uniqueTransfers.map(transfer =>
      transformAlchemyTransfer(transfer, address, chainId, chain)
    );

    // Sort by block number (newest first)
    activities.sort((a, b) => b.blockNumber - a.blockNumber);

    return activities;

  } catch (error) {
    console.error(`Alchemy API error for chain ${chainId}:`, error);
    throw error;
  }
}

/**
 * Transform Alchemy AssetTransfersResult to OnChainActivity
 */
function transformAlchemyTransfer(
  transfer: AssetTransfersResult,
  userAddress: `0x${string}`,
  chainId: number,
  chain: any
): OnChainActivity {
  const isIncoming = transfer.to?.toLowerCase() === userAddress.toLowerCase();
  
  // Determine transaction type
  let type: TransactionType = 'unknown';
  if (transfer.category === 'external' || transfer.category === 'internal') {
    type = isIncoming ? 'receive' : 'send';
  } else if (transfer.category === 'erc20') {
    type = 'token-transfer';
  } else if (transfer.category === 'erc721' || transfer.category === 'erc1155') {
    type = 'token-transfer'; // NFT transfer
  }

  // Parse block number (comes as hex string from Alchemy)
  const blockNumber = parseInt(transfer.blockNum, 16);

  // Get timestamp from metadata (if available)
  const timestamp = (transfer as any).metadata?.blockTimestamp
    ? new Date((transfer as any).metadata.blockTimestamp).getTime()
    : Date.now();

  // Format value
  const value = transfer.value ?? 0;
  const valueFormatted = typeof value === 'number' 
    ? value.toFixed(6)
    : String(value);

  // Get token info for ERC-20 transfers
  let tokenTransfers = undefined;
  if (transfer.category === 'erc20' && transfer.rawContract) {
    const decimals = typeof transfer.rawContract.decimal === 'number'
      ? transfer.rawContract.decimal
      : parseInt(transfer.rawContract.decimal || '18', 10);
    
    tokenTransfers = [{
      address: transfer.rawContract.address as `0x${string}`,
      symbol: transfer.asset || 'Unknown',
      name: transfer.asset || 'Unknown Token',
      decimals,
      amount: valueFormatted,
      amountRaw: transfer.rawContract.value || '0',
    }];
  }

  // Generate description
  const description = generateAlchemyDescription(
    type,
    isIncoming,
    valueFormatted,
    transfer.asset,
    transfer.to || transfer.from
  );

  // Use transaction hash
  const txHash = transfer.hash as `0x${string}`;

  return {
    id: `${chainId}-${txHash}`,
    txHash,
    chainId,
    type,
    status: 'confirmed', // Alchemy only returns confirmed transactions
    timestamp,
    blockNumber,
    from: (transfer.from || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    to: (transfer.to || '0x0000000000000000000000000000000000000000') as `0x${string}`,
    isIncoming,
    counterparty: {
      address: (isIncoming ? transfer.from : transfer.to) as `0x${string}`,
    },
    value: {
      amount: valueFormatted,
      amountRaw: transfer.rawContract?.value || '0',
      symbol: transfer.asset || chain.nativeCurrency.symbol,
    },
    tokenTransfers,
    gas: {
      used: '0', // Not provided by getAssetTransfers
      price: '0',
      cost: '0',
    },
    description,
    method: undefined, // Could enhance with transaction receipt lookup
    explorerUrl: `${chain.explorerUrl}/tx/${txHash}`,
    source: 'blockchain',
  };
}

/**
 * Generate human-readable description from Alchemy transfer data
 */
function generateAlchemyDescription(
  type: TransactionType,
  isIncoming: boolean,
  amount: string,
  asset: string | null,
  counterparty: string | null
): string {
  const shortAddress = counterparty
    ? `${counterparty.slice(0, 6)}...${counterparty.slice(-4)}`
    : 'unknown';

  const assetSymbol = asset || 'tokens';
  const amountStr = parseFloat(amount) > 0.0001
    ? `${parseFloat(amount).toFixed(4)} ${assetSymbol}`
    : assetSymbol;

  switch (type) {
    case 'send':
      return `Sent ${amountStr} to ${shortAddress}`;
    case 'receive':
      return `Received ${amountStr} from ${shortAddress}`;
    case 'token-transfer':
      return isIncoming
        ? `Received ${amountStr} from ${shortAddress}`
        : `Sent ${amountStr} to ${shortAddress}`;
    case 'swap':
      return `Swapped ${assetSymbol}`;
    case 'bridge':
      return `Bridged ${assetSymbol}`;
    default:
      return isIncoming
        ? `Received from ${shortAddress}`
        : `Sent to ${shortAddress}`;
  }
}

/**
 * Fetch detailed transaction receipt to get gas information
 * (Optional enhancement - can be called separately if needed)
 */
export async function fetchTransactionDetails(
  chainId: number,
  txHash: `0x${string}`
): Promise<{
  gasUsed: string;
  gasPrice: string;
  gasCost: string;
  methodName?: string;
} | null> {
  if (!isAlchemySupported(chainId)) {
    return null;
  }

  try {
    const alchemy = getAlchemyClient(chainId);
    
    // Fetch transaction receipt for gas info
    const receipt = await alchemy.core.getTransactionReceipt(txHash);
    if (!receipt) return null;

    const gasUsed = receipt.gasUsed.toString();
    const gasPrice = receipt.effectiveGasPrice?.toString() || '0';
    const gasCost = (BigInt(gasUsed) * BigInt(gasPrice)) / BigInt(1e18);

    // Optionally fetch transaction to get method name
    let methodName: string | undefined;
    const tx = await alchemy.core.getTransaction(txHash);
    if (tx?.data && tx.data !== '0x') {
      // Extract method signature (first 4 bytes)
      methodName = tx.data.slice(0, 10);
    }

    return {
      gasUsed,
      gasPrice: (Number(gasPrice) / 1e9).toFixed(2), // Convert to Gwei
      gasCost: gasCost.toString(),
      methodName,
    };
  } catch (error) {
    console.error(`Failed to fetch tx details for ${txHash}:`, error);
    return null;
  }
}
