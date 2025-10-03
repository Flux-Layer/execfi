// lib/defi/types.ts - DeFi domain types

/**
 * Swap intent from AI parser
 */
export interface SwapIntent {
  action: "swap";
  fromChain: string | number;
  toChain?: string | number; // Optional, defaults to fromChain
  fromToken: string;
  toToken: string;
  amount: string;
  recipient?: string;
  slippage?: number;
  _selectedFromToken?: any; // Pre-selected token from selection flow
  _selectedToToken?: any; // Pre-selected token from selection flow
}

/**
 * Bridge intent from AI parser
 */
export interface BridgeIntent {
  action: "bridge";
  fromChain: string | number;
  toChain: string | number;
  token: string;
  amount: string;
  recipient?: string;
  _selectedToken?: any; // Pre-selected token from selection flow
}

/**
 * Bridge-swap intent from AI parser
 */
export interface BridgeSwapIntent {
  action: "bridge_swap";
  fromChain: string | number;
  toChain: string | number;
  fromToken: string;
  toToken: string;
  amount: string;
  recipient?: string;
  slippage?: number;
  _selectedFromToken?: any; // Pre-selected token from selection flow
  _selectedToToken?: any; // Pre-selected token from selection flow
}

/**
 * Normalized swap (ready for execution)
 */
export interface NormalizedSwap {
  kind: "swap";
  fromChainId: number;
  toChainId: number;
  fromToken: {
    address: `0x${string}`;
    symbol: string;
    decimals: number;
  };
  toToken: {
    address: `0x${string}`;
    symbol: string;
    decimals: number;
  };
  fromAmount: bigint;
  recipient: `0x${string}`;
}

/**
 * Normalized bridge (ready for execution)
 */
export interface NormalizedBridge {
  kind: "bridge";
  fromChainId: number;
  toChainId: number;
  token: {
    address: `0x${string}`;
    symbol: string;
    decimals: number;
  };
  amount: bigint;
  recipient: `0x${string}`;
}

/**
 * Normalized bridge-swap (ready for execution)
 */
export interface NormalizedBridgeSwap {
  kind: "bridge-swap";
  fromChainId: number;
  toChainId: number;
  fromToken: {
    address: `0x${string}`;
    symbol: string;
    decimals: number;
  };
  toToken: {
    address: `0x${string}`;
    symbol: string;
    decimals: number;
  };
  fromAmount: bigint;
  recipient: `0x${string}`;
}

/**
 * Union type for all DeFi normalized intents
 */
export type NormalizedDeFi = NormalizedSwap | NormalizedBridge | NormalizedBridgeSwap;

/**
 * DeFi validation result
 */
export interface DeFiValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * DeFi execution result
 */
export interface DeFiExecutionResult {
  success: boolean;
  txHash: string;
  explorerUrl: string;
  message: string;
}
