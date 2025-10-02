// lib/ai/schema.ts - Zod schemas for Intent validation

import { z } from 'zod';

// Token schema for native transfers - supports all chain native tokens
const NativeTokenSchema = z.object({
  type: z.literal('native'),
  symbol: z.string(), // ETH, AVAX, MATIC, etc.
  decimals: z.number(), // Usually 18, but flexible
});

// Token schema for ERC-20 transfers
const ERC20TokenSchema = z.object({
  type: z.literal('erc20'),
  symbol: z.string(),
  decimals: z.number().optional(), // Will be resolved during normalization
  address: z.string().optional(), // Will be resolved during normalization
});

// Union token schema
const TokenSchema = z.union([
  NativeTokenSchema,
  ERC20TokenSchema,
]);

// Transfer intent schema
const TransferIntentSchema = z.object({
  action: z.literal('transfer'),
  chain: z.union([z.string(), z.number()]), // "base" | 8453
  token: TokenSchema,
  amount: z.string(), // decimal string or "MAX"
  recipient: z.string(), // 0x address or ENS
  useSession: z.boolean().optional(), // whether to use session key for automated signing
});

// Swap intent schema - same chain token exchange
const SwapIntentSchema = z.object({
  action: z.literal('swap'),
  fromChain: z.union([z.string(), z.number()]),
  toChain: z.union([z.string(), z.number()]).optional(), // Defaults to fromChain
  fromToken: z.string(),
  toToken: z.string(),
  amount: z.string(),
  recipient: z.string().optional(), // Defaults to sender
  slippage: z.number().optional(), // Optional slippage tolerance
});

// Bridge intent schema - same token cross-chain transfer
const BridgeIntentSchema = z.object({
  action: z.literal('bridge'),
  fromChain: z.union([z.string(), z.number()]),
  toChain: z.union([z.string(), z.number()]),
  token: z.string(), // Same token on both chains
  amount: z.string(),
  recipient: z.string().optional(), // Defaults to sender's address on destination chain
});

// Bridge-swap intent schema - cross-chain token exchange
const BridgeSwapIntentSchema = z.object({
  action: z.literal('bridge_swap'),
  fromChain: z.union([z.string(), z.number()]),
  toChain: z.union([z.string(), z.number()]),
  fromToken: z.string(),
  toToken: z.string(),
  amount: z.string(),
  recipient: z.string().optional(), // Defaults to sender's address on destination chain
  slippage: z.number().optional(), // Optional slippage tolerance
});

// Union of all intent types
const IntentUnionSchema = z.union([
  TransferIntentSchema,
  SwapIntentSchema,
  BridgeIntentSchema,
  BridgeSwapIntentSchema,
]);

// Success response schema
const IntentSuccessSchema = z.object({
  ok: z.literal(true),
  intent: IntentUnionSchema,
});

// Clarify response schema
const IntentClarifySchema = z.object({
  ok: z.literal(false),
  clarify: z.string().min(1), // short question
  missing: z.array(z.string()), // fields needed
});

// Chat response schema (for casual conversation/questions)
const IntentChatSchema = z.object({
  ok: z.literal("chat"),
  response: z.string().min(1), // natural conversational response
});

// Token selection response schema (for ambiguous tokens)
const IntentTokenSelectionSchema = z.object({
  ok: z.literal("tokenSelection"),
  tokenSelection: z.object({
    message: z.string().min(1),
    tokens: z.array(z.object({
      id: z.number(),
      chainId: z.number(),
      address: z.string(),
      name: z.string(),
      symbol: z.string(),
      logoURI: z.string().optional(),
      verified: z.boolean().optional(),
    })),
  }),
});

// Main intent schema (discriminated union)
export const IntentSchema = z.discriminatedUnion('ok', [
  IntentSuccessSchema,
  IntentClarifySchema,
  IntentTokenSelectionSchema,
  IntentChatSchema,
]);

// Export types
export type IntentSuccess = z.infer<typeof IntentSuccessSchema>;
export type IntentClarify = z.infer<typeof IntentClarifySchema>;
export type IntentTokenSelection = z.infer<typeof IntentTokenSelectionSchema>;
export type IntentChat = z.infer<typeof IntentChatSchema>;
export type Intent = z.infer<typeof IntentSchema>;
export type TransferIntent = z.infer<typeof TransferIntentSchema>;
export type SwapIntent = z.infer<typeof SwapIntentSchema>;
export type BridgeIntent = z.infer<typeof BridgeIntentSchema>;
export type BridgeSwapIntent = z.infer<typeof BridgeSwapIntentSchema>;

// Validation helper
export function validateIntent(data: unknown): Intent {
  return IntentSchema.parse(data);
}

// Type guards
export function isIntentSuccess(intent: Intent): intent is IntentSuccess {
  return intent.ok === true;
}

export function isIntentClarify(intent: Intent): intent is IntentClarify {
  return intent.ok === false && 'clarify' in intent;
}

export function isIntentTokenSelection(intent: Intent): intent is IntentTokenSelection {
  return intent.ok === "tokenSelection";
}

export function isIntentChat(intent: Intent): intent is IntentChat {
  return intent.ok === "chat";
}

export function isTransferIntent(intent: IntentSuccess['intent']): intent is TransferIntent {
  return intent.action === 'transfer';
}

export function isSwapIntent(intent: IntentSuccess['intent']): intent is SwapIntent {
  return intent.action === 'swap';
}

export function isBridgeIntent(intent: IntentSuccess['intent']): intent is BridgeIntent {
  return intent.action === 'bridge';
}

export function isBridgeSwapIntent(intent: IntentSuccess['intent']): intent is BridgeSwapIntent {
  return intent.action === 'bridge_swap';
}