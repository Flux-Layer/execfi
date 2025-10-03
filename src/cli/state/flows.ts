// Flow definitions - declarative flow DSL
import type { FlowDef, FlowName } from "./types";

// Import all effect functions
import { parseIntentFx } from "../effects/intent";
import { normalizeFx } from "../effects/normalize";
import { validateFx } from "../effects/validate";
import { simulateGasFx, skipFx } from "../effects/simulate";
import { clarifyToastFx, confirmTransferFx } from "../effects/confirm";
import { executePrivyFx } from "../effects/execute";
import { monitorFx } from "../effects/monitor";
import { successFx, failureFx } from "../effects/feedback";
import { planSwapFx, planBridgeFx, planBridgeSwapFx, skipPlanFx } from "../effects/plan";

/**
 * Transfer flow definition
 * Native ETH transfers using Privy Smart Accounts
 */
export const transferFlow: FlowDef = {
  parse: {
    onEnter: parseIntentFx,
  },
  clarify: {
    onEnter: clarifyToastFx,
    // Stay in clarify until user provides more input
  },
  normalize: {
    onEnter: normalizeFx,
  },
  validate: {
    onEnter: validateFx,
  },
  plan: {
    // Native transfers don't need complex planning
    onEnter: skipPlanFx,
  },
  simulate: {
    onEnter: simulateGasFx,
  },
  confirm: {
    // Terminal-based confirmation with summary display
    onEnter: confirmTransferFx,
  },
  execute: {
    onEnter: executePrivyFx,
  },
  monitor: {
    onEnter: monitorFx,
  },
  success: {
    onEnter: successFx,
  },
  failure: {
    onEnter: failureFx,
  },
};

/**
 * Swap flow definition - same-chain token exchange
 */
export const swapFlow: FlowDef = {
  parse: {
    onEnter: parseIntentFx,
  },
  clarify: {
    onEnter: clarifyToastFx,
  },
  normalize: {
    onEnter: normalizeFx,
  },
  validate: {
    onEnter: validateFx,
  },
  plan: {
    onEnter: planSwapFx,
  },
  simulate: {
    onEnter: skipFx, // Swaps use LI.FI quote, skip simulation
  },
  confirm: {
    // Terminal-based confirmation - no overlay needed
  },
  execute: {
    onEnter: executePrivyFx,
  },
  monitor: {
    onEnter: monitorFx,
  },
  success: {
    onEnter: successFx,
  },
  failure: {
    onEnter: failureFx,
  },
};

/**
 * Bridge flow definition - same token cross-chain transfer
 */
export const bridgeFlow: FlowDef = {
  parse: {
    onEnter: parseIntentFx,
  },
  clarify: {
    onEnter: clarifyToastFx,
  },
  normalize: {
    onEnter: normalizeFx,
  },
  validate: {
    onEnter: validateFx,
  },
  plan: {
    onEnter: planBridgeFx,
  },
  simulate: {
    onEnter: skipFx, // Bridges use LI.FI quote, skip simulation
  },
  confirm: {
    // Terminal-based confirmation - no overlay needed
  },
  execute: {
    onEnter: executePrivyFx,
  },
  monitor: {
    onEnter: monitorFx,
  },
  success: {
    onEnter: successFx,
  },
  failure: {
    onEnter: failureFx,
  },
};

/**
 * Bridge-swap flow definition - cross-chain token exchange
 */
export const bridgeSwapFlow: FlowDef = {
  parse: {
    onEnter: parseIntentFx,
  },
  clarify: {
    onEnter: clarifyToastFx,
  },
  normalize: {
    onEnter: normalizeFx,
  },
  validate: {
    onEnter: validateFx,
  },
  plan: {
    onEnter: planBridgeSwapFx,
  },
  simulate: {
    onEnter: skipFx, // Bridge-swaps use LI.FI quote, skip simulation
  },
  confirm: {
    // Terminal-based confirmation - no overlay needed
  },
  execute: {
    onEnter: executePrivyFx,
  },
  monitor: {
    onEnter: monitorFx,
  },
  success: {
    onEnter: successFx,
  },
  failure: {
    onEnter: failureFx,
  },
};

/**
 * Registry of all available flows
 */
export const FLOWS: Record<FlowName, FlowDef> = {
  transfer: transferFlow,
  swap: swapFlow,
  bridge: bridgeFlow,
  "bridge-swap": bridgeSwapFlow,
};

/**
 * Get flow definition by name
 */
export function getFlow(name: FlowName): FlowDef | undefined {
  return FLOWS[name];
}

/**
 * Get all available flow names
 */
export function getAvailableFlows(): FlowName[] {
  return Object.keys(FLOWS) as FlowName[];
}

/**
 * Check if a flow supports a specific step
 */
export function flowSupportsStep(flowName: FlowName, step: string): boolean {
  const flow = getFlow(flowName);
  return flow ? step in flow : false;
}