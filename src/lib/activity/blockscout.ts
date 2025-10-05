// lib/activity/blockscout.ts - Blockscout API client for fetching on-chain transactions

import { getChainConfig } from '@/lib/chains/registry';
import type { OnChainActivity, TransactionType } from './types';

interface BlockscoutTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  timeStamp: string;
  blockNumber: string;
  isError: '0' | '1';
  txreceipt_status: '0' | '1';
  input: string;
  methodId: string;
  functionName: string;
}

interface BlockscoutTokenTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimal: string;
  contractAddress: string;
  timeStamp: string;
}

/**
 * Fetch normal transactions from Blockscout
 */
export async function fetchTransactions(
  chainId: number,
  address: `0x${string}`,
  options?: {
    startBlock?: number;
    endBlock?: number;
    page?: number;
    offset?: number; // Max results per page (default: 100)
  }
): Promise<BlockscoutTransaction[]> {
  const chain = getChainConfig(chainId);
  if (!chain) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }

  // Use Etherscan V2 unified API endpoint
  // https://api.etherscan.io/v2/api with chainid parameter
  const apiUrl = 'https://api.etherscan.io/v2/api';

  const params = new URLSearchParams({
    chainid: chainId.toString(), // Unified API uses chainid parameter
    module: 'account',
    action: 'txlist',
    address: address.toLowerCase(),
    startblock: options?.startBlock?.toString() || '0',
    endblock: options?.endBlock?.toString() || '99999999',
    page: options?.page?.toString() || '1',
    offset: options?.offset?.toString() || '50', // Reduced default for faster response
    sort: 'desc', // Latest first
  });

  // Add Etherscan API key if available (works across all chains)
  const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || process.env.NEXT_PUBLIC_BASESCAN_API_KEY;
  if (apiKey) {
    params.append('apikey', apiKey);
  }

  const response = await fetch(`${apiUrl}?${params}`);

  if (!response.ok) {
    throw new Error(`Etherscan API error: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.status !== '1') {
    // No transactions found or API error
    if (data.message === 'No transactions found') {
      return [];
    }
    throw new Error(data.message || 'Unknown Etherscan API error');
  }

  return data.result as BlockscoutTransaction[];
}

/**
 * Fetch ERC-20 token transfers from Blockscout
 */
export async function fetchTokenTransfers(
  chainId: number,
  address: `0x${string}`,
  options?: {
    contractAddress?: `0x${string}`; // Filter by token contract
    page?: number;
    offset?: number;
  }
): Promise<BlockscoutTokenTransfer[]> {
  const chain = getChainConfig(chainId);
  if (!chain) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }

  // Use Etherscan V2 unified API endpoint
  const apiUrl = 'https://api.etherscan.io/v2/api';

  const params = new URLSearchParams({
    chainid: chainId.toString(), // Unified API uses chainid parameter
    module: 'account',
    action: 'tokentx',
    address: address.toLowerCase(),
    page: options?.page?.toString() || '1',
    offset: options?.offset?.toString() || '50', // Reduced default
    sort: 'desc',
  });

  if (options?.contractAddress) {
    params.append('contractaddress', options.contractAddress.toLowerCase());
  }

  // Add Etherscan API key if available (works across all chains)
  const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || process.env.NEXT_PUBLIC_BASESCAN_API_KEY;
  if (apiKey) {
    params.append('apikey', apiKey);
  }

  const response = await fetch(`${apiUrl}?${params}`);

  if (!response.ok) {
    throw new Error(`Etherscan API error: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.status !== '1') {
    if (data.message === 'No transactions found') {
      return [];
    }
    throw new Error(data.message || 'Unknown Etherscan API error');
  }

  return data.result as BlockscoutTokenTransfer[];
}

/**
 * Transform Blockscout transaction to OnChainActivity
 */
export function transformBlockscoutTx(
  tx: BlockscoutTransaction,
  userAddress: `0x${string}`,
  chainId: number
): OnChainActivity {
  const chain = getChainConfig(chainId)!;
  const isIncoming = tx.to.toLowerCase() === userAddress.toLowerCase();
  const txFailed = tx.isError === '1' || tx.txreceipt_status === '0';

  // Determine transaction type
  let type: TransactionType = 'unknown';
  if (tx.input === '0x' || tx.input === '') {
    type = isIncoming ? 'receive' : 'send';
  } else {
    // Check method signature
    const methodId = tx.methodId || tx.input.slice(0, 10);
    type = inferTransactionType(methodId, tx.functionName);
  }

  // Calculate gas cost
  const gasUsed = BigInt(tx.gasUsed);
  const gasPrice = BigInt(tx.gasPrice);
  const gasCost = gasUsed * gasPrice;
  const gasCostEth = (Number(gasCost) / 1e18).toFixed(6);

  // Format value
  const valueWei = BigInt(tx.value);
  const valueEth = (Number(valueWei) / 1e18).toFixed(6);

  // Generate description
  const description = generateDescription(type, isIncoming, valueEth, chain.nativeCurrency.symbol, tx.to);

  return {
    id: `${chainId}-${tx.hash}`,
    txHash: tx.hash as `0x${string}`,
    chainId,
    type,
    status: txFailed ? 'failed' : 'confirmed',
    timestamp: parseInt(tx.timeStamp) * 1000, // Convert to ms
    blockNumber: parseInt(tx.blockNumber),
    from: tx.from as `0x${string}`,
    to: tx.to as `0x${string}`,
    isIncoming,
    counterparty: {
      address: (isIncoming ? tx.from : tx.to) as `0x${string}`,
    },
    value: {
      amount: valueEth,
      amountRaw: tx.value,
      symbol: chain.nativeCurrency.symbol,
    },
    gas: {
      used: tx.gasUsed,
      price: (Number(tx.gasPrice) / 1e9).toFixed(2), // Convert to Gwei
      cost: gasCostEth,
    },
    description,
    method: tx.functionName,
    explorerUrl: `${chain.explorerUrl}/tx/${tx.hash}`,
    source: 'blockchain',
  };
}

/**
 * Infer transaction type from method signature
 */
function inferTransactionType(methodId: string, functionName?: string): TransactionType {
  const methodMap: Record<string, TransactionType> = {
    '0x095ea7b3': 'approve',      // approve(address,uint256)
    '0xa9059cbb': 'token-transfer', // transfer(address,uint256)
    '0x23b872dd': 'token-transfer', // transferFrom(address,address,uint256)
    '0x38ed1739': 'swap',         // swapExactTokensForTokens
    '0x7ff36ab5': 'swap',         // swapExactETHForTokens
    '0x18cbafe5': 'swap',         // swapExactTokensForETH
    '0xfb3bdb41': 'swap',         // swapETHForExactTokens
  };

  if (methodMap[methodId]) {
    return methodMap[methodId];
  }

  // Fallback: check function name
  if (functionName) {
    const lowerName = functionName.toLowerCase();
    if (lowerName.includes('swap')) return 'swap';
    if (lowerName.includes('bridge')) return 'bridge';
    if (lowerName.includes('approve')) return 'approve';
    if (lowerName.includes('transfer')) return 'token-transfer';
  }

  return 'contract-call';
}

/**
 * Generate human-readable description
 */
function generateDescription(
  type: TransactionType,
  isIncoming: boolean,
  amount: string,
  symbol: string,
  counterparty: string
): string {
  const shortAddress = `${counterparty.slice(0, 6)}...${counterparty.slice(-4)}`;

  switch (type) {
    case 'send':
      return `Sent ${amount} ${symbol} to ${shortAddress}`;
    case 'receive':
      return `Received ${amount} ${symbol} from ${shortAddress}`;
    case 'swap':
      return `Swapped tokens`;
    case 'bridge':
      return `Bridged assets`;
    case 'approve':
      return `Approved token spending`;
    case 'token-transfer':
      return isIncoming ? `Received tokens from ${shortAddress}` : `Sent tokens to ${shortAddress}`;
    default:
      return `Contract interaction with ${shortAddress}`;
  }
}
