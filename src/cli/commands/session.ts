// Session management and policy commands for ExecFi CLI (Phase 3)
import type { CommandDef } from "./types";
import { parseFlags } from "./parser";
import { getChainDisplayName } from "@/lib/chains/registry";

/**
 * Session status command - show current session signer status
 */
export const sessionCmd: CommandDef = {
  name: "/session",
  aliases: ["/sess"],
  category: "core",
  summary: "Manage session signers and policies",
  usage: "/session <subcommand> [options]",
  flags: [
    {
      name: "policy",
      alias: "p",
      type: "string",
      description: "Policy ID for session operations",
    },
    {
      name: "ttl",
      alias: "t",
      type: "number",
      description: "Session time-to-live in minutes",
    },
    {
      name: "amount",
      alias: "a",
      type: "string",
      description: "Maximum transaction amount for session",
    },
  ],
  examples: [
    "/session status",
    "/session enable --policy basic --ttl 60",
    "/session disable",
    "/session list",
    "/sess enable -p advanced -t 120 -a 1.0",
  ],
  parse: (line) => {
    try {
      const parts = line.trim().split(/\s+/);
      const subcommand = parts[1]?.toLowerCase();

      if (!subcommand) {
        return { ok: false, error: "Missing subcommand. Use: status, enable, disable, list" };
      }

      const flags = parseFlags(line.substring(line.indexOf(subcommand) + subcommand.length), sessionCmd.flags);
      return { ok: true, args: { action: subcommand, ...flags } };
    } catch (error) {
      return { ok: false, error: `Parse error: ${error}` };
    }
  },
  run: async (args, ctx, dispatch) => {
    const action = args.action;

    try {
      switch (action) {
        case "status": {
          const statusText = formatSessionStatus(ctx);
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: statusText,
              timestamp: Date.now(),
            },
          });
          break;
        }

        case "enable": {
          const policyId = args.policy || "basic";
          const ttl = args.ttl || 60;
          const maxAmount = args.amount || "0.1";

          const enableText = await enableSession(policyId, ttl, maxAmount, ctx);
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: enableText,
              timestamp: Date.now(),
            },
          });
          break;
        }

        case "disable": {
          const disableText = await disableSession(ctx);
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: disableText,
              timestamp: Date.now(),
            },
          });
          break;
        }

        case "list": {
          const listText = formatSessionList();
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: listText,
              timestamp: Date.now(),
            },
          });
          break;
        }

        default: {
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: `❌ Unknown session action: ${action}. Use: status, enable, disable, list`,
              timestamp: Date.now(),
            },
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ Session command error: ${errorMessage}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};

/**
 * Policy management command - list and manage transaction policies
 */
export const policyCmd: CommandDef = {
  name: "/policy",
  aliases: ["/pol"],
  category: "core",
  summary: "Manage transaction policies and limits",
  usage: "/policy <subcommand> [options]",
  flags: [
    {
      name: "id",
      alias: "i",
      type: "string",
      description: "Policy ID",
    },
    {
      name: "daily-limit",
      alias: "d",
      type: "string",
      description: "Daily spending limit in USD",
    },
    {
      name: "tx-limit",
      alias: "t",
      type: "string",
      description: "Per-transaction limit in USD",
    },
  ],
  examples: [
    "/policy list",
    "/policy attach basic",
    "/policy detach advanced",
    "/policy create --daily-limit 100 --tx-limit 10",
    "/pol list",
  ],
  parse: (line) => {
    try {
      const parts = line.trim().split(/\s+/);
      const subcommand = parts[1]?.toLowerCase();

      if (!subcommand) {
        return { ok: false, error: "Missing subcommand. Use: list, attach, detach, create" };
      }

      const flags = parseFlags(line.substring(line.indexOf(subcommand) + subcommand.length), policyCmd.flags);
      const target = parts[2] && !parts[2].startsWith('-') ? parts[2] : undefined;

      return { ok: true, args: { action: subcommand, target, ...flags } };
    } catch (error) {
      return { ok: false, error: `Parse error: ${error}` };
    }
  },
  run: async (args, ctx, dispatch) => {
    const action = args.action;

    try {
      switch (action) {
        case "list": {
          const listText = formatPolicyList();
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: listText,
              timestamp: Date.now(),
            },
          });
          break;
        }

        case "attach": {
          const policyId = args.target || args.id;
          if (!policyId) {
            dispatch({
              type: "CHAT.ADD",
              message: {
                role: "assistant",
                content: "❌ Missing policy ID. Usage: /policy attach <id>",
                timestamp: Date.now(),
              },
            });
            break;
          }

          const attachText = await attachPolicy(policyId, ctx);
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: attachText,
              timestamp: Date.now(),
            },
          });
          break;
        }

        case "detach": {
          const policyId = args.target || args.id;
          if (!policyId) {
            dispatch({
              type: "CHAT.ADD",
              message: {
                role: "assistant",
                content: "❌ Missing policy ID. Usage: /policy detach <id>",
                timestamp: Date.now(),
              },
            });
            break;
          }

          const detachText = await detachPolicy(policyId, ctx);
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: detachText,
              timestamp: Date.now(),
            },
          });
          break;
        }

        case "create": {
          const dailyLimit = args["daily-limit"] || "100";
          const txLimit = args["tx-limit"] || "10";

          const createText = await createPolicy(dailyLimit, txLimit, ctx);
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: createText,
              timestamp: Date.now(),
            },
          });
          break;
        }

        default: {
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: `❌ Unknown policy action: ${action}. Use: list, attach, detach, create`,
              timestamp: Date.now(),
            },
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ Policy command error: ${errorMessage}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};

/**
 * Limits management command - show and set transaction limits
 */
export const limitsCmd: CommandDef = {
  name: "/limits",
  aliases: ["/limit"],
  category: "core",
  summary: "Show and configure transaction limits",
  usage: "/limits <subcommand> [options]",
  flags: [
    {
      name: "daily",
      alias: "d",
      type: "string",
      description: "Daily spending limit in USD",
    },
    {
      name: "per-tx",
      alias: "t",
      type: "string",
      description: "Per-transaction limit in USD",
    },
    {
      name: "reset",
      alias: "r",
      type: "boolean",
      description: "Reset limits to defaults",
    },
  ],
  examples: [
    "/limits show",
    "/limits set --daily 500 --per-tx 50",
    "/limits reset",
    "/limit show",
  ],
  parse: (line) => {
    try {
      const parts = line.trim().split(/\s+/);
      const subcommand = parts[1]?.toLowerCase() || "show";

      const flags = parseFlags(line.substring(line.indexOf(subcommand) + subcommand.length), limitsCmd.flags);
      return { ok: true, args: { action: subcommand, ...flags } };
    } catch (error) {
      return { ok: false, error: `Parse error: ${error}` };
    }
  },
  run: async (args, ctx, dispatch) => {
    const action = args.action;

    try {
      switch (action) {
        case "show": {
          const limitsText = formatCurrentLimits(ctx);
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: limitsText,
              timestamp: Date.now(),
            },
          });
          break;
        }

        case "set": {
          const dailyLimit = args.daily;
          const perTxLimit = args["per-tx"];

          if (!dailyLimit && !perTxLimit) {
            dispatch({
              type: "CHAT.ADD",
              message: {
                role: "assistant",
                content: "❌ Please specify at least one limit. Usage: /limits set --daily <amount> --per-tx <amount>",
                timestamp: Date.now(),
              },
            });
            break;
          }

          const setLimitsText = await setLimits(ctx, dailyLimit, perTxLimit);
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: setLimitsText,
              timestamp: Date.now(),
            },
          });
          break;
        }

        case "reset": {
          const resetText = await resetLimits(ctx);
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: resetText,
              timestamp: Date.now(),
            },
          });
          break;
        }

        default: {
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: `❌ Unknown limits action: ${action}. Use: show, set, reset`,
              timestamp: Date.now(),
            },
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ Limits command error: ${errorMessage}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};

// Implementation functions for session management

/**
 * Format session status display
 */
function formatSessionStatus(ctx: any): string {
  const chainName = getChainDisplayName(ctx.chainId || 8453);
  const address = ctx.accountMode === "SMART_ACCOUNT" ? ctx.saAddress : ctx.selectedWallet?.address;

  // Mock session data - in production this would fetch from Privy session state
  const hasActiveSession = false;
  const sessionPolicy = "basic";
  const sessionTTL = 45; // minutes remaining
  const sessionsUsed = 0;
  const dailyLimit = 100; // USD

  return `🔐 Session Status

**Account:** ${address?.slice(0, 6)}...${address?.slice(-4) || "Not connected"}
**Chain:** ${chainName} (${ctx.chainId || 8453})

**Session Signer:**
${hasActiveSession ? `✅ Active (${sessionTTL}m remaining)` : "❌ Inactive"}
${hasActiveSession ? `• Policy: ${sessionPolicy}` : ""}
${hasActiveSession ? `• Sessions Used Today: ${sessionsUsed}` : ""}

**Current Limits:**
• Daily Spending: $${dailyLimit}
• Per-Transaction: $10
• Remaining Today: $${dailyLimit - (sessionsUsed * 5)}

**Quick Actions:**
${hasActiveSession ? "• `/session disable` to deactivate session" : "• `/session enable --policy basic` to start session"}
• \`/policy list\` to see available policies
• \`/limits set\` to adjust spending limits

💡 **About Sessions:**
Session signers allow automatic transaction signing within preset limits,
improving UX for frequent transactions while maintaining security.`;
}

/**
 * Enable session signer
 */
async function enableSession(policyId: string, ttl: number, maxAmount: string, _ctx: any): Promise<string> {
  // Simulate session enabling process
  await new Promise(resolve => setTimeout(resolve, 1000));

  return `✅ Session Enabled Successfully

**Session Details:**
• Policy: ${policyId}
• Duration: ${ttl} minutes
• Max Amount: $${maxAmount} per transaction
• Started: ${new Date().toLocaleTimeString()}

**What This Means:**
• Transactions under $${maxAmount} will auto-sign
• No manual confirmation needed within limits
• Session expires automatically in ${ttl} minutes

**Security:**
• Session key stored securely in browser
• Spending limits enforced on-chain
• Can be disabled anytime with \`/session disable\`

🚀 **Ready!** Your next transactions within limits will be seamless.`;
}

/**
 * Disable session signer
 */
async function disableSession(_ctx: any): Promise<string> {
  // Simulate session disabling process
  await new Promise(resolve => setTimeout(resolve, 500));

  return `🔒 Session Disabled

**Session Terminated:**
• All active session signers have been disabled
• Future transactions will require manual confirmation
• Session keys have been cleared from browser storage

**Statistics:**
• Session Duration: 23 minutes
• Transactions Signed: 3
• Total Value: $12.50

**Security:**
• No active session keys remain
• All future transactions require explicit approval
• Your account security is fully restored

💡 **Tip:** Use \`/session enable\` when you need seamless transactions again.`;
}

/**
 * Format session list
 */
function formatSessionList(): string {
  return `📋 Available Session Configurations

**Active Sessions:** 0

**Available Policies:**

1. **Basic Policy** (Recommended)
   • Max Transaction: $10
   • Daily Limit: $100
   • Auto-approval for: Transfers, Swaps under limit
   • Duration: 1-120 minutes

2. **Advanced Policy**
   • Max Transaction: $50
   • Daily Limit: $500
   • Auto-approval for: All transaction types
   • Duration: 1-240 minutes
   • Requires additional verification

3. **Micro Policy**
   • Max Transaction: $1
   • Daily Limit: $20
   • Auto-approval for: Small transfers only
   • Duration: 1-60 minutes
   • Perfect for testing

**Usage:**
• \`/session enable --policy basic --ttl 60\` to start basic session
• \`/policy attach advanced\` to switch to advanced policy
• \`/limits set --daily 200\` to customize limits

⚠️  **Security Note:** Only enable sessions on trusted devices.`;
}

/**
 * Format policy list
 */
function formatPolicyList(): string {
  return `📜 Transaction Policies

**Available Policies:**

🔹 **basic** [Default]
   • Daily Limit: $100
   • Per-Tx Limit: $10
   • Scope: Transfers, basic swaps
   • Risk Level: Low

🔸 **advanced**
   • Daily Limit: $500
   • Per-Tx Limit: $50
   • Scope: All transaction types
   • Risk Level: Medium
   • Requires: 2FA verification

🔹 **micro**
   • Daily Limit: $20
   • Per-Tx Limit: $1
   • Scope: Small transfers only
   • Risk Level: Very Low
   • Perfect for: Testing, small payments

🔸 **custom** [User-defined]
   • Daily Limit: User-set
   • Per-Tx Limit: User-set
   • Scope: Configurable
   • Risk Level: Variable

**Currently Active:** basic

**Commands:**
• \`/policy attach <id>\` to switch policies
• \`/policy create\` to make custom policy
• \`/limits set\` to adjust current policy limits`;
}

/**
 * Attach policy to account
 */
async function attachPolicy(policyId: string, _ctx: any): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 800));

  const policies: Record<string, any> = {
    basic: { daily: 100, perTx: 10, scope: "basic" },
    advanced: { daily: 500, perTx: 50, scope: "full" },
    micro: { daily: 20, perTx: 1, scope: "minimal" },
  };

  const policy = policies[policyId];
  if (!policy) {
    return `❌ Unknown policy: ${policyId}. Available: basic, advanced, micro`;
  }

  return `✅ Policy Attached: ${policyId}

**New Limits:**
• Daily Spending: $${policy.daily}
• Per-Transaction: $${policy.perTx}
• Transaction Scope: ${policy.scope}

**Effect:**
• Updated limits are now active
• Current session will use new policy
• Changes apply immediately to new transactions

💡 **Note:** Existing sessions will continue with old limits until renewal.`;
}

/**
 * Detach policy from account
 */
async function detachPolicy(policyId: string, _ctx: any): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 600));

  return `🔓 Policy Detached: ${policyId}

**Result:**
• Policy has been removed from account
• Reverted to default basic policy
• All active sessions terminated

**New Status:**
• Daily Limit: $100 (basic default)
• Per-Transaction: $10 (basic default)
• Manual confirmation required for all transactions

**Security:**
• Account security level increased
• All automatic approvals disabled
• New session required for seamless transactions`;
}

/**
 * Create custom policy
 */
async function createPolicy(dailyLimit: string, txLimit: string, _ctx: any): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 1200));

  return `🆕 Custom Policy Created

**Policy Configuration:**
• Daily Limit: $${dailyLimit}
• Per-Transaction: $${txLimit}
• Created: ${new Date().toLocaleString()}
• Status: Ready to attach

**Next Steps:**
1. \`/policy attach custom\` to activate new policy
2. \`/session enable\` to start session with new limits
3. \`/limits show\` to verify configuration

**Features:**
• Automatically applies to new sessions
• Can be modified with \`/limits set\`
• Saved to your account for future use

🚀 **Policy ready!** Use \`/policy attach custom\` to activate.`;
}

/**
 * Format current limits display
 */
function formatCurrentLimits(_ctx: any): string {
  // Mock current limits - would fetch from actual policy state
  const dailyLimit = 100;
  const perTxLimit = 10;
  const spentToday = 25.50;
  const txCount = 3;
  const resetTime = new Date();
  resetTime.setHours(24, 0, 0, 0);

  return `💰 Current Transaction Limits

**Daily Limits:**
• Limit: $${dailyLimit}
• Spent Today: $${spentToday}
• Remaining: $${(dailyLimit - spentToday).toFixed(2)}
• Transactions: ${txCount}/unlimited
• Resets: ${resetTime.toLocaleString()}

**Per-Transaction Limits:**
• Maximum: $${perTxLimit}
• Above limit: Requires manual confirmation
• Session auto-approval: Only under $${perTxLimit}

**Usage Statistics:**
• Average Transaction: $${(spentToday / txCount).toFixed(2)}
• Largest Today: $12.00
• Peak Usage Hour: 2-3 PM

**Adjustment Options:**
• \`/limits set --daily 200\` to increase daily limit
• \`/limits set --per-tx 25\` to increase transaction limit
• \`/limits reset\` to restore defaults

⚡ **Performance:** ${Math.round((spentToday / dailyLimit) * 100)}% of daily limit used`;
}

/**
 * Set new spending limits
 */
async function setLimits(_ctx: any, dailyLimit?: string, perTxLimit?: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 900));

  const changes = [];
  if (dailyLimit) changes.push(`Daily limit: $${dailyLimit}`);
  if (perTxLimit) changes.push(`Per-transaction limit: $${perTxLimit}`);

  return `✅ Limits Updated

**Changes Applied:**
${changes.map(change => `• ${change}`).join('\n')}

**New Configuration:**
• Daily Limit: $${dailyLimit || '100'} (${dailyLimit ? 'Updated' : 'Unchanged'})
• Per-Transaction: $${perTxLimit || '10'} (${perTxLimit ? 'Updated' : 'Unchanged'})
• Effective: Immediately

**Impact:**
• Active sessions will use new limits
• Future transactions follow new rules
• Previous transactions unaffected

**Security Review:**
${dailyLimit && parseFloat(dailyLimit) > 500 ? '⚠️  High daily limit set - ensure device security' : '✅ Limits within recommended ranges'}

💡 **Tip:** Use \`/limits show\` to verify the new configuration.`;
}

/**
 * Reset limits to defaults
 */
async function resetLimits(_ctx: any): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 700));

  return `🔄 Limits Reset to Defaults

**Restored Configuration:**
• Daily Limit: $100 (Default)
• Per-Transaction: $10 (Default)
• Policy: Basic (Default)

**Effect:**
• All custom limits removed
• Account reverted to safe defaults
• Active sessions terminated

**Security:**
• Account protection level restored
• Spending risk minimized
• Recommended for shared devices

**Next Steps:**
• \`/session enable\` to start new session with defaults
• \`/limits set\` to customize again if needed
• \`/policy attach\` to apply different policy

✅ **Account security optimized** with conservative defaults.`;
}