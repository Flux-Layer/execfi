// lib/activity/types.ts - Type definitions for on-chain activity

export type TransactionType =
  | 'send'           // Native token send
  | 'receive'        // Native token receive
  | 'token-transfer' // ERC-20 transfer
  | 'swap'           // DEX swap
  | 'bridge'         // Cross-chain bridge
  | 'approve'        // Token approval
  | 'contract-call'  // Generic contract interaction
  | 'unknown';       // Fallback

export type TransactionStatus =
  | 'confirmed'      // On-chain confirmed
  | 'pending'        // In mempool
  | 'failed'         // Reverted
  | 'app-initiated'; // From chat history, not yet on-chain

export interface TokenInfo {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  amount: string;      // Human-readable (e.g., "100.5")
  amountRaw: string;   // Wei/smallest unit
  logoUri?: string;
}

export interface OnChainActivity {
  // Core identifiers
  id: string;                    // Composite: `${chainId}-${txHash}`
  txHash: `0x${string}`;
  chainId: number;

  // Transaction metadata
  type: TransactionType;
  status: TransactionStatus;
  timestamp: number;             // Unix timestamp (ms)
  blockNumber: number;

  // Participants
  from: `0x${string}`;
  to: `0x${string}`;
  isIncoming: boolean;           // True if user is recipient
  counterparty?: {
    address: `0x${string}`;
    name?: string;               // ENS or known contract
  };

  // Value transferred
  value: {
    amount: string;              // Human-readable
    amountRaw: string;           // Wei
    symbol: string;              // ETH, MATIC, etc.
    usdValue?: number;           // Future: price oracle
  };

  // Token transfers (ERC-20)
  tokenTransfers?: TokenInfo[];

  // Gas & fees
  gas: {
    used: string;
    price: string;               // Gwei
    cost: string;                // ETH
    costUsd?: number;
  };

  // UI metadata
  description: string;           // "Sent 0.5 ETH to 0x123..."
  method?: string;               // Contract method name
  explorerUrl: string;

  // Source tracking
  source: 'blockchain' | 'chat-history';
}
