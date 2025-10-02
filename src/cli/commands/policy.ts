// Policy management commands for ExecFi CLI
import type { CommandDef } from "./types";
import type { CoreContext, Dispatch } from "../state/types";
import type { PolicyPreset, PolicyState } from "@/lib/policy/types";
import { POLICY_PRESETS, POLICY_DESCRIPTIONS } from "@/lib/policy/presets";
import { savePolicy, createDefaultPolicy } from "@/lib/policy/storage";

/**
 * Main policy command - manage transaction policies and safety limits
 */
export const policyCmd: CommandDef = {
  name: "/policy",
  aliases: ["/pol"],
  category: "core",
  summary: "Manage transaction policies and safety limits",
  usage: "/policy <subcommand> [options]",
  examples: [
    "/policy show",
    "/policy preset safe",
    "/policy preset moderate",
    "/policy set-max-tx 2.0",
    "/policy set-daily-limit 10.0",
    "/policy set-confirm-threshold 0.5",
    "/policy reset",
  ],
  parse: (line) => {
    const parts = line.trim().split(/\s+/);
    const subcommand = parts[1]?.toLowerCase();
    const arg1 = parts[2];
    const arg2 = parts[3];

    if (!subcommand) {
      return { ok: false, error: "Missing subcommand. Use: show, preset, set-max-tx, set-daily-limit, reset" };
    }

    return { ok: true, args: { action: subcommand, arg1, arg2 } };
  },
  run: async (args, ctx, dispatch) => {
    const { action, arg1, arg2 } = args;

    try {
      switch (action) {
        case "show":
        case "status":
          return showPolicy(ctx, dispatch);

        case "preset":
          return setPreset(ctx, dispatch, arg1 as PolicyPreset);

        case "set-max-tx":
          return updateMaxTx(ctx, dispatch, parseFloat(arg1));

        case "set-daily-limit":
          return updateDailyLimit(ctx, dispatch, parseFloat(arg1));

        case "set-confirm-threshold":
          return updateConfirmThreshold(ctx, dispatch, parseFloat(arg1));

        case "set-hourly-limit":
          return updateHourlyLimit(ctx, dispatch, parseInt(arg1));

        case "allow-zero-address":
          return toggleZeroAddress(ctx, dispatch, true);

        case "block-zero-address":
          return toggleZeroAddress(ctx, dispatch, false);

        case "allow-unverified-tokens":
          return toggleUnverifiedTokens(ctx, dispatch, true);

        case "block-unverified-tokens":
          return toggleUnverifiedTokens(ctx, dispatch, false);

        case "reset":
          return resetPolicy(ctx, dispatch, arg1 as PolicyPreset);

        default:
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: `❌ Unknown policy action: ${action}. Try: show, preset, set-max-tx, set-daily-limit, reset`,
              timestamp: Date.now(),
            },
          });
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

// Implementation functions

function showPolicy(ctx: CoreContext, dispatch: Dispatch): void {
  const { policy } = ctx;
  const { config, metadata, dailySpent, dailyTxCount, hourlyTxCount } = policy;

  const content = `📋 **Current Policy Configuration**

**Preset:** ${metadata.preset} (${POLICY_DESCRIPTIONS[metadata.preset]})
**Last Modified:** ${new Date(metadata.lastModified).toLocaleString()}

**Transaction Limits:**
• Max Per-Transaction: ${config.maxTxAmountETH} ETH
• Daily Spending Limit: ${config.dailyLimitETH} ETH
• Confirmation Threshold: ${config.confirmationThresholdETH} ETH
• Min Balance After Tx: ${config.minBalanceAfterTxETH} ETH

**Usage Quotas:**
• Hourly Tx Limit: ${config.maxTxPerHour} tx/hour (Used: ${hourlyTxCount})
• Daily Tx Limit: ${config.maxTxPerDay} tx/day (Used: ${dailyTxCount})

**Daily Spending:**
• Spent Today: ${dailySpent.toFixed(4)} ETH
• Remaining: ${(config.dailyLimitETH - dailySpent).toFixed(4)} ETH
• Reset: Tomorrow at midnight

**Security Settings:**
• Block Zero Address: ${config.blockZeroAddress ? "✅ Yes" : "❌ No"}
• Block Unverified Tokens: ${config.blockUnverifiedTokens ? "✅ Yes" : "❌ No"}
• Require Manual Confirm: ${config.requireManualConfirm ? "✅ Yes" : "❌ No"}
• Gas Headroom: ${(config.gasHeadroomMultiplier * 100).toFixed(0)}%

${config.allowedChains?.length ? `**Allowed Chains:** ${config.allowedChains.join(", ")}` : "**Allowed Chains:** All"}
${config.blockedAddresses?.length ? `**Blocked Addresses:** ${config.blockedAddresses.length} addresses` : ""}

**Quick Actions:**
• \`/policy preset safe\` - Switch to conservative limits
• \`/policy set-max-tx 2.0\` - Increase max transaction to 2 ETH
• \`/policy reset\` - Reset to defaults`;

  dispatch({
    type: "CHAT.ADD",
    message: { role: "assistant", content, timestamp: Date.now() },
  });
}

function setPreset(ctx: CoreContext, dispatch: Dispatch, preset: PolicyPreset): void {
  if (!preset) {
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `❌ Missing preset name. Available: safe, moderate, advanced\n\nExamples:\n• \`/policy preset safe\` - Conservative limits\n• \`/policy preset moderate\` - Balanced protection\n• \`/policy preset advanced\` - Higher limits`,
        timestamp: Date.now(),
      },
    });
    return;
  }

  if (!POLICY_PRESETS[preset]) {
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `❌ Unknown preset: ${preset}. Available: safe, moderate, advanced`,
        timestamp: Date.now(),
      },
    });
    return;
  }

  const newPolicy: PolicyState = {
    config: { ...POLICY_PRESETS[preset] },
    metadata: {
      preset,
      lastModified: Date.now(),
      version: ctx.policy.metadata.version,
    },
    // Preserve runtime tracking
    dailySpent: ctx.policy.dailySpent,
    dailyTxCount: ctx.policy.dailyTxCount,
    hourlyTxCount: ctx.policy.hourlyTxCount,
    lastResetDate: ctx.policy.lastResetDate,
    lastResetHour: ctx.policy.lastResetHour,
  };

  savePolicy(newPolicy);
  dispatch({ type: "POLICY.UPDATE", policy: newPolicy });

  dispatch({
    type: "CHAT.ADD",
    message: {
      role: "assistant",
      content: `✅ Policy preset changed to: **${preset}**\n\n${POLICY_DESCRIPTIONS[preset]}\n\nUse \`/policy show\` to see details.`,
      timestamp: Date.now(),
    },
  });
}

function updateMaxTx(ctx: CoreContext, dispatch: Dispatch, amount: number): void {
  if (isNaN(amount) || amount <= 0) {
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `❌ Invalid amount. Usage: /policy set-max-tx <amount>\n\nExample: \`/policy set-max-tx 2.5\``,
        timestamp: Date.now(),
      },
    });
    return;
  }

  const updatedPolicy: PolicyState = {
    ...ctx.policy,
    config: {
      ...ctx.policy.config,
      maxTxAmountETH: amount,
    },
    metadata: {
      ...ctx.policy.metadata,
      preset: "custom",
      lastModified: Date.now(),
    },
  };

  savePolicy(updatedPolicy);
  dispatch({ type: "POLICY.UPDATE", policy: updatedPolicy });

  dispatch({
    type: "CHAT.ADD",
    message: {
      role: "assistant",
      content: `✅ Max transaction amount updated to **${amount} ETH**`,
      timestamp: Date.now(),
    },
  });
}

function updateDailyLimit(ctx: CoreContext, dispatch: Dispatch, amount: number): void {
  if (isNaN(amount) || amount <= 0) {
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `❌ Invalid amount. Usage: /policy set-daily-limit <amount>\n\nExample: \`/policy set-daily-limit 10.0\``,
        timestamp: Date.now(),
      },
    });
    return;
  }

  const updatedPolicy: PolicyState = {
    ...ctx.policy,
    config: {
      ...ctx.policy.config,
      dailyLimitETH: amount,
    },
    metadata: {
      ...ctx.policy.metadata,
      preset: "custom",
      lastModified: Date.now(),
    },
  };

  savePolicy(updatedPolicy);
  dispatch({ type: "POLICY.UPDATE", policy: updatedPolicy });

  dispatch({
    type: "CHAT.ADD",
    message: {
      role: "assistant",
      content: `✅ Daily spending limit updated to **${amount} ETH**`,
      timestamp: Date.now(),
    },
  });
}

function updateConfirmThreshold(ctx: CoreContext, dispatch: Dispatch, amount: number): void {
  if (isNaN(amount) || amount < 0) {
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `❌ Invalid amount. Usage: /policy set-confirm-threshold <amount>\n\nExample: \`/policy set-confirm-threshold 0.5\``,
        timestamp: Date.now(),
      },
    });
    return;
  }

  const updatedPolicy: PolicyState = {
    ...ctx.policy,
    config: {
      ...ctx.policy.config,
      confirmationThresholdETH: amount,
    },
    metadata: {
      ...ctx.policy.metadata,
      preset: "custom",
      lastModified: Date.now(),
    },
  };

  savePolicy(updatedPolicy);
  dispatch({ type: "POLICY.UPDATE", policy: updatedPolicy });

  dispatch({
    type: "CHAT.ADD",
    message: {
      role: "assistant",
      content: `✅ Confirmation threshold updated to **${amount} ETH**\n\nTransactions above this amount will require manual confirmation.`,
      timestamp: Date.now(),
    },
  });
}

function updateHourlyLimit(ctx: CoreContext, dispatch: Dispatch, limit: number): void {
  if (isNaN(limit) || limit <= 0) {
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `❌ Invalid limit. Usage: /policy set-hourly-limit <count>\n\nExample: \`/policy set-hourly-limit 20\``,
        timestamp: Date.now(),
      },
    });
    return;
  }

  const updatedPolicy: PolicyState = {
    ...ctx.policy,
    config: {
      ...ctx.policy.config,
      maxTxPerHour: limit,
    },
    metadata: {
      ...ctx.policy.metadata,
      preset: "custom",
      lastModified: Date.now(),
    },
  };

  savePolicy(updatedPolicy);
  dispatch({ type: "POLICY.UPDATE", policy: updatedPolicy });

  dispatch({
    type: "CHAT.ADD",
    message: {
      role: "assistant",
      content: `✅ Hourly transaction limit updated to **${limit} transactions per hour**`,
      timestamp: Date.now(),
    },
  });
}

function toggleZeroAddress(ctx: CoreContext, dispatch: Dispatch, allow: boolean): void {
  const updatedPolicy: PolicyState = {
    ...ctx.policy,
    config: {
      ...ctx.policy.config,
      blockZeroAddress: !allow,
    },
    metadata: {
      ...ctx.policy.metadata,
      preset: "custom",
      lastModified: Date.now(),
    },
  };

  savePolicy(updatedPolicy);
  dispatch({ type: "POLICY.UPDATE", policy: updatedPolicy });

  dispatch({
    type: "CHAT.ADD",
    message: {
      role: "assistant",
      content: allow
        ? `✅ Zero address transfers are now **allowed**\n\n⚠️ Warning: Sending to 0x0000...0000 burns tokens permanently!`
        : `✅ Zero address transfers are now **blocked**\n\nThis prevents accidental token burns.`,
      timestamp: Date.now(),
    },
  });
}

function toggleUnverifiedTokens(ctx: CoreContext, dispatch: Dispatch, allow: boolean): void {
  const updatedPolicy: PolicyState = {
    ...ctx.policy,
    config: {
      ...ctx.policy.config,
      blockUnverifiedTokens: !allow,
    },
    metadata: {
      ...ctx.policy.metadata,
      preset: "custom",
      lastModified: Date.now(),
    },
  };

  savePolicy(updatedPolicy);
  dispatch({ type: "POLICY.UPDATE", policy: updatedPolicy });

  dispatch({
    type: "CHAT.ADD",
    message: {
      role: "assistant",
      content: allow
        ? `✅ Unverified token transfers are now **allowed**\n\n⚠️ Warning: Unverified tokens may be scams or have issues.`
        : `✅ Unverified token transfers are now **blocked**\n\nOnly verified tokens can be transferred.`,
      timestamp: Date.now(),
    },
  });
}

function resetPolicy(ctx: CoreContext, dispatch: Dispatch, preset?: PolicyPreset): void {
  const targetPreset = preset && POLICY_PRESETS[preset] ? preset : "moderate";

  const newPolicy = createDefaultPolicy(targetPreset);

  savePolicy(newPolicy);
  dispatch({ type: "POLICY.RESET", preset: targetPreset });
  dispatch({ type: "POLICY.UPDATE", policy: newPolicy });

  dispatch({
    type: "CHAT.ADD",
    message: {
      role: "assistant",
      content: `🔄 Policy reset to **${targetPreset}** preset\n\n${POLICY_DESCRIPTIONS[targetPreset]}\n\nUse \`/policy show\` to see current settings.`,
      timestamp: Date.now(),
    },
  });
}
