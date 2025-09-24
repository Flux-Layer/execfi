// Flow definitions - declarative flow DSL
import type { FlowDef, FlowName } from "./types";

// Import all effect functions
import { parseIntentFx } from "../effects/intent";
import { normalizeFx } from "../effects/normalize";
import { validateFx } from "../effects/validate";
import { simulateGasFx, skipFx } from "../effects/simulate";
import { clarifyToastFx } from "../effects/confirm";
import { executePrivyFx } from "../effects/execute";
import { monitorFx } from "../effects/monitor";
import { successFx, failureFx } from "../effects/feedback";

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
    onEnter: skipFx,
  },
  simulate: {
    onEnter: simulateGasFx,
  },
  confirm: {
    // Terminal-based confirmation - no overlay needed
    // User confirms via HSMCurLine input (press Enter or type yes/no)
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
 * Swap flow definition (placeholder for future implementation)
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
    onEnter: skipFx, // TODO: Implement swap planning with LI.FI
  },
  simulate: {
    onEnter: simulateGasFx,
  },
  confirm: {
    // Terminal-based confirmation - no overlay needed
  },
  execute: {
    onEnter: executePrivyFx, // TODO: Implement swap execution
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
 * Bridge flow definition (placeholder for future implementation)
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
    onEnter: skipFx, // TODO: Implement bridge planning with LI.FI
  },
  simulate: {
    onEnter: simulateGasFx,
  },
  confirm: {
    // Terminal-based confirmation - no overlay needed
  },
  execute: {
    onEnter: executePrivyFx, // TODO: Implement bridge execution
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
 * Bridge-swap flow definition (placeholder for future implementation)
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
    onEnter: skipFx, // TODO: Implement complex bridge-swap planning
  },
  simulate: {
    onEnter: simulateGasFx,
  },
  confirm: {
    // Terminal-based confirmation - no overlay needed
  },
  execute: {
    onEnter: executePrivyFx, // TODO: Implement bridge-swap execution
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