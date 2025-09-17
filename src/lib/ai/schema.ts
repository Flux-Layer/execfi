// lib/ai/schema.ts - Zod schemas for Intent validation

import { z } from 'zod';

// Token schema for native transfers
const NativeTokenSchema = z.object({
  type: z.literal('native'),
  symbol: z.literal('ETH'),
  decimals: z.literal(18),
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
});

// Future: Swap/Bridge intent schemas (not implemented in MVP)
const SwapIntentSchema = z.object({
  action: z.enum(['swap', 'bridge', 'bridge_swap']),
  fromChain: z.union([z.string(), z.number()]),
  toChain: z.union([z.string(), z.number()]).optional(),
  fromToken: z.string(),
  toToken: z.string(),
  amount: z.string(),
});

// Union of all intent types
const IntentUnionSchema = z.union([
  TransferIntentSchema,
  SwapIntentSchema,
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

// Main intent schema (discriminated union)
export const IntentSchema = z.discriminatedUnion('ok', [
  IntentSuccessSchema,
  IntentClarifySchema,
]);

// Export types
export type IntentSuccess = z.infer<typeof IntentSuccessSchema>;
export type IntentClarify = z.infer<typeof IntentClarifySchema>;
export type Intent = z.infer<typeof IntentSchema>;
export type TransferIntent = z.infer<typeof TransferIntentSchema>;

// Validation helper
export function validateIntent(data: unknown): Intent {
  return IntentSchema.parse(data);
}

// Type guards
export function isIntentSuccess(intent: Intent): intent is IntentSuccess {
  return intent.ok === true;
}

export function isIntentClarify(intent: Intent): intent is IntentClarify {
  return intent.ok === false;
}

export function isTransferIntent(intent: IntentSuccess['intent']): intent is TransferIntent {
  return intent.action === 'transfer';
}