// lib/transfer/types.ts - Transfer domain types

/**
 * Transfer intent from AI parser
 */
export interface TransferIntent {
  action: "transfer";
  chain: string | number;
  token: {
    type: "native" | "erc20";
    symbol: string;
    address?: string;
  };
  amount: string;
  recipient: string;
}

/**
 * Normalized transfer (ready for execution)
 */
export type NormalizedTransfer =
  | NormalizedNativeTransfer
  | NormalizedERC20Transfer;

export interface NormalizedNativeTransfer {
  kind: "native-transfer";
  chainId: number;
  to: `0x${string}`;
  amountWei: bigint;
}

export interface NormalizedERC20Transfer {
  kind: "erc20-transfer";
  chainId: number;
  to: `0x${string}`;
  amountWei: bigint;
  token: {
    address: `0x${string}`;
    symbol: string;
    decimals: number;
  };
}

/**
 * Transfer validation result
 */
export interface TransferValidationResult {
  valid: boolean;
  gasEstimate: bigint;
  gasCost: bigint;
  errors?: string[];
}

/**
 * Transfer execution result
 */
export interface TransferExecutionResult {
  success: boolean;
  txHash: string;
  explorerUrl: string;
  message: string;
}

/**
 * Transfer monitoring result
 */
export interface TransferMonitoringResult {
  status: "pending" | "confirmed" | "failed";
  confirmations?: number;
  error?: string;
}
