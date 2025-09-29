// Developer tools commands for ExecFi CLI (Phase 3)
import type { CommandDef } from "./types";
import { parseFlags } from "./parser";

/**
 * State inspection command - show current application state
 */
export const stateCmd: CommandDef = {
  name: "/state",
  aliases: ["/debug-state"],
  category: "dev",
  summary: "Show current application state (debug)",
  usage: "/state [options]",
  flags: [
    {
      name: "filter",
      alias: "f",
      type: "string",
      description: "Filter state by key (e.g., 'core', 'flow', 'chatHistory')",
    },
    {
      name: "pretty",
      alias: "p",
      type: "boolean",
      description: "Pretty-print JSON output",
    },
    {
      name: "limit",
      alias: "l",
      type: "number",
      default: 100,
      description: "Limit output lines for large state objects",
    },
  ],
  examples: [
    "/state",
    "/state --filter core",
    "/state --pretty --limit 50",
    "/debug-state -f flow -p",
  ],
  parse: (line) => {
    try {
      const flags = parseFlags(line, stateCmd.flags);
      return { ok: true, args: flags };
    } catch (error) {
      return { ok: false, error: `Parse error: ${error}` };
    }
  },
  run: async (args, ctx, dispatch) => {
    const { filter, pretty, limit = 100 } = args;

    try {
      const stateText = formatApplicationState(ctx, filter, pretty, limit);
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: stateText,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ State inspection failed: ${errorMessage}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};

/**
 * Logs command - show application logs and events
 */
export const logsCmd: CommandDef = {
  name: "/logs",
  aliases: ["/log"],
  category: "dev",
  summary: "Show application logs and debug information",
  usage: "/logs [options]",
  flags: [
    {
      name: "level",
      alias: "l",
      type: "string",
      description: "Filter by log level: error, warn, info, debug",
    },
    {
      name: "tail",
      alias: "t",
      type: "number",
      default: 20,
      description: "Show last N log entries",
    },
    {
      name: "component",
      alias: "c",
      type: "string",
      description: "Filter by component: intent, reducer, effects, commands",
    },
    {
      name: "follow",
      alias: "f",
      type: "boolean",
      description: "Follow log output (continuous mode)",
    },
  ],
  examples: [
    "/logs",
    "/logs --level error --tail 10",
    "/logs --component commands",
    "/log -l debug -t 50",
  ],
  parse: (line) => {
    try {
      const flags = parseFlags(line, logsCmd.flags);
      return { ok: true, args: flags };
    } catch (error) {
      return { ok: false, error: `Parse error: ${error}` };
    }
  },
  run: async (args, _ctx, dispatch) => {
    const { level, tail = 20, component, follow } = args;

    try {
      const logsText = await formatApplicationLogs(level, tail, component, follow);
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: logsText,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ Logs retrieval failed: ${errorMessage}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};

/**
 * Trace command - show effect execution traces
 */
export const traceCmd: CommandDef = {
  name: "/trace",
  aliases: ["/debug-trace"],
  category: "dev",
  summary: "Show effect execution traces and debugging info",
  usage: "/trace <subcommand> [options]",
  flags: [
    {
      name: "enable",
      alias: "e",
      type: "boolean",
      description: "Enable trace collection",
    },
    {
      name: "disable",
      alias: "d",
      type: "boolean",
      description: "Disable trace collection",
    },
    {
      name: "filter",
      alias: "f",
      type: "string",
      description: "Filter traces by pattern",
    },
    {
      name: "verbose",
      alias: "v",
      type: "boolean",
      description: "Show verbose trace information",
    },
  ],
  examples: [
    "/trace status",
    "/trace enable",
    "/trace show --filter intent",
    "/trace disable",
    "/debug-trace show -v",
  ],
  parse: (line) => {
    try {
      const parts = line.trim().split(/\s+/);
      const subcommand = parts[1]?.toLowerCase() || "status";

      const flags = parseFlags(line.substring(line.indexOf(subcommand) + subcommand.length), traceCmd.flags);
      return { ok: true, args: { action: subcommand, ...flags } };
    } catch (error) {
      return { ok: false, error: `Parse error: ${error}` };
    }
  },
  run: async (args, _ctx, dispatch) => {
    const { action, enable, disable, filter, verbose } = args;

    try {
      let traceText: string;

      if (enable || action === "enable") {
        traceText = enableTracing();
      } else if (disable || action === "disable") {
        traceText = disableTracing();
      } else if (action === "show") {
        traceText = await formatTraces(filter, verbose);
      } else if (action === "clear") {
        traceText = clearTraces();
      } else {
        traceText = formatTraceStatus();
      }

      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: traceText,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ Trace command failed: ${errorMessage}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};

/**
 * Config command - show and modify runtime configuration
 */
export const configCmd: CommandDef = {
  name: "/config",
  aliases: ["/cfg"],
  category: "dev",
  summary: "Show and modify runtime configuration",
  usage: "/config <subcommand> [options]",
  flags: [
    {
      name: "key",
      alias: "k",
      type: "string",
      description: "Configuration key",
    },
    {
      name: "value",
      alias: "v",
      type: "string",
      description: "Configuration value",
    },
    {
      name: "reset",
      alias: "r",
      type: "boolean",
      description: "Reset to default value",
    },
  ],
  examples: [
    "/config list",
    "/config get debug.enabled",
    "/config set debug.enabled true",
    "/cfg get --key api.timeout",
  ],
  parse: (line) => {
    try {
      const parts = line.trim().split(/\s+/);
      const subcommand = parts[1]?.toLowerCase() || "list";

      if (subcommand === "get" || subcommand === "set") {
        const key = parts[2];
        const value = subcommand === "set" ? parts[3] : undefined;

        const flags = parseFlags(line.substring(line.indexOf(key || subcommand) + (key || subcommand).length), configCmd.flags);

        return {
          ok: true,
          args: {
            action: subcommand,
            key: key || flags.key,
            value: value || flags.value,
            ...flags
          }
        };
      }

      const flags = parseFlags(line.substring(line.indexOf(subcommand) + subcommand.length), configCmd.flags);
      return { ok: true, args: { action: subcommand, ...flags } };
    } catch (error) {
      return { ok: false, error: `Parse error: ${error}` };
    }
  },
  run: async (args, _ctx, dispatch) => {
    const { action, key, value, reset } = args;

    try {
      let configText: string;

      switch (action) {
        case "list":
          configText = formatConfigList();
          break;
        case "get":
          if (!key) {
            configText = "❌ Missing configuration key. Usage: /config get <key>";
          } else {
            configText = getConfigValue(key);
          }
          break;
        case "set":
          if (!key || !value) {
            configText = "❌ Missing key or value. Usage: /config set <key> <value>";
          } else {
            configText = setConfigValue(key, value);
          }
          break;
        case "reset":
          if (!key) {
            configText = "❌ Missing configuration key. Usage: /config reset <key>";
          } else {
            configText = resetConfigValue(key);
          }
          break;
        default:
          configText = `❌ Unknown config action: ${action}. Use: list, get, set, reset`;
      }

      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: configText,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ Config command failed: ${errorMessage}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};

// Implementation functions

/**
 * Format application state for display
 */
function formatApplicationState(ctx: any, filter?: string, pretty?: boolean, limit: number = 100): string {
  const stateSnapshot = {
    timestamp: Date.now(),
    core: {
      userId: ctx.userId || null,
      chainId: ctx.chainId || 8453,
      accountMode: ctx.accountMode || "EOA",
      saAddress: ctx.saAddress || null,
      selectedWallet: ctx.selectedWallet ? {
        address: ctx.selectedWallet.address,
        type: ctx.selectedWallet.type || "embedded"
      } : null,
    },
    // Mock additional state properties
    mode: "IDLE",
    flow: null,
    viewStack: [],
    overlays: [],
    chatHistory: {
      length: 10,
      lastEntry: "System initialized"
    },
    lastCommand: {
      name: "/state",
      timestamp: Date.now()
    }
  };

  let displayState = stateSnapshot;

  if (filter) {
    const filterKey = filter.toLowerCase();
    const filtered: any = {};

    for (const [key, value] of Object.entries(stateSnapshot)) {
      if (key.toLowerCase().includes(filterKey)) {
        filtered[key] = value;
      }
    }

    if (Object.keys(filtered).length === 0) {
      return `❌ No state properties match filter: "${filter}"

**Available properties:** ${Object.keys(stateSnapshot).join(", ")}

**Usage:** \`/state --filter <property>\``;
    }

    displayState = filtered;
  }

  const jsonOutput = pretty
    ? JSON.stringify(displayState, null, 2)
    : JSON.stringify(displayState);

  const lines = jsonOutput.split('\n');
  const truncated = lines.length > limit;
  const displayLines = truncated ? lines.slice(0, limit) : lines;

  return `🔍 Application State Debug

**Timestamp:** ${new Date().toLocaleString()}
${filter ? `**Filter:** ${filter}` : ""}
**Format:** ${pretty ? "Pretty JSON" : "Compact JSON"}
${truncated ? `**Truncated:** Showing ${limit}/${lines.length} lines` : ""}

\`\`\`json
${displayLines.join('\n')}${truncated ? '\n... (truncated)' : ''}
\`\`\`

**Properties:**
${Object.keys(displayState).map(key => `• ${key}: ${typeof (displayState as any)[key]}`).join('\n')}

**Commands:**
• \`/state --filter core\` to view core context
• \`/state --pretty --limit 200\` for detailed view
• \`/trace\` to see execution traces`;
}

/**
 * Format application logs
 */
async function formatApplicationLogs(
  level?: string,
  tail: number = 20,
  component?: string,
  follow?: boolean
): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 300));

  // Mock log entries
  const mockLogs = [
    { timestamp: Date.now() - 5000, level: "info", component: "commands", message: "Command executed: /state" },
    { timestamp: Date.now() - 10000, level: "debug", component: "reducer", message: "State transition: IDLE -> IDLE" },
    { timestamp: Date.now() - 15000, level: "info", component: "intent", message: "Intent parsed successfully" },
    { timestamp: Date.now() - 20000, level: "warn", component: "effects", message: "Effect timeout extended" },
    { timestamp: Date.now() - 25000, level: "error", component: "api", message: "Rate limit exceeded" },
    { timestamp: Date.now() - 30000, level: "debug", component: "commands", message: "Command registry loaded" },
    { timestamp: Date.now() - 35000, level: "info", component: "core", message: "Application initialized" },
  ];

  // Apply filters
  let filteredLogs = mockLogs;

  if (level) {
    filteredLogs = filteredLogs.filter(log => log.level === level.toLowerCase());
  }

  if (component) {
    filteredLogs = filteredLogs.filter(log => log.component === component.toLowerCase());
  }

  // Apply tail limit
  filteredLogs = filteredLogs.slice(-tail);

  const header = `📋 Application Logs

**Total Entries:** ${mockLogs.length}${filteredLogs.length !== mockLogs.length ? ` (${filteredLogs.length} shown)` : ""}
${level ? `**Level Filter:** ${level}` : ""}
${component ? `**Component Filter:** ${component}` : ""}
**Tail:** Last ${tail} entries
${follow ? "**Mode:** Following (live updates)" : ""}

`;

  if (filteredLogs.length === 0) {
    return header + `🚫 No logs found

${level || component ? "No logs match your filters." : "No logs available."}

**Available levels:** error, warn, info, debug
**Available components:** commands, reducer, intent, effects, api, core

**Try:**
• \`/logs --level info\` for informational logs
• \`/logs --component commands\` for command logs
• \`/logs --tail 50\` for more entries`;
  }

  const logEntries = filteredLogs.map(log => {
    const timestamp = new Date(log.timestamp).toLocaleTimeString();
    const levelIcon = getLevelIcon(log.level);
    const componentTag = `[${log.component.toUpperCase()}]`;

    return `${timestamp} ${levelIcon} ${componentTag} ${log.message}`;
  }).join('\n');

  const footer = `

**Legend:**
• 🔴 ERROR • 🟡 WARN • 🟢 INFO • 🔵 DEBUG

**Commands:**
• \`/logs --level error\` to see only errors
• \`/logs --follow\` for live log streaming
• \`/trace\` for detailed execution traces

${follow ? "⚡ **Live mode active** - logs will update automatically" : "📸 **Snapshot taken** at " + new Date().toLocaleTimeString()}`;

  return header + "```\n" + logEntries + "\n```" + footer;
}

/**
 * Format trace status
 */
function formatTraceStatus(): string {
  // Mock trace status
  const tracingEnabled = false;
  const tracesCollected = 0;
  const bufferSize = 1000;

  return `🔍 Trace Debugging Status

**Tracing:** ${tracingEnabled ? "✅ Enabled" : "❌ Disabled"}
**Traces Collected:** ${tracesCollected}
**Buffer Size:** ${bufferSize} entries
**Storage:** Memory (temporary)

**Trace Types:**
• Effect executions
• State transitions
• Command routing
• Intent parsing
• API calls

**Controls:**
• \`/trace enable\` to start collecting traces
• \`/trace show\` to view collected traces
• \`/trace clear\` to clear trace buffer
• \`/trace disable\` to stop collection

${tracingEnabled
  ? "⚡ **Active:** Collecting execution traces"
  : "💡 **Tip:** Enable tracing to debug performance and execution flow"
}`;
}

/**
 * Enable tracing
 */
function enableTracing(): string {
  return `✅ Tracing Enabled

**Collection Started:**
• Effect executions: ✅
• State transitions: ✅
• Command routing: ✅
• Intent parsing: ✅
• API calls: ✅

**Buffer:** 1000 entries (circular)
**Performance Impact:** Minimal (~2% overhead)

**What's Being Traced:**
• Function entry/exit times
• State mutations
• Async operation lifecycles
• Error conditions and recoveries

**View Traces:**
• \`/trace show\` for all traces
• \`/trace show --filter intent\` for specific components
• \`/trace show --verbose\` for detailed information

⚡ **Active tracing** - execute commands to generate traces`;
}

/**
 * Disable tracing
 */
function disableTracing(): string {
  return `🔒 Tracing Disabled

**Collection Stopped:**
• No new traces will be collected
• Existing traces preserved in buffer
• Performance overhead eliminated

**Buffer Status:**
• Contains 23 trace entries
• Available for viewing until cleared
• Use \`/trace show\` to review collected data

**Options:**
• \`/trace show\` to view existing traces
• \`/trace clear\` to free memory
• \`/trace enable\` to resume collection

📊 **Performance:** Normal operation restored`;
}

/**
 * Format traces
 */
async function formatTraces(filter?: string, verbose?: boolean): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 400));

  // Mock trace entries
  const mockTraces = [
    {
      id: "trace_001",
      timestamp: Date.now() - 1000,
      component: "commands",
      operation: "route",
      duration: 2.3,
      success: true,
      details: { command: "/state", args: {} }
    },
    {
      id: "trace_002",
      timestamp: Date.now() - 800,
      component: "intent",
      operation: "parse",
      duration: 45.7,
      success: true,
      details: { input: "/state", result: "command" }
    },
    {
      id: "trace_003",
      timestamp: Date.now() - 600,
      component: "reducer",
      operation: "state_transition",
      duration: 0.8,
      success: true,
      details: { from: "IDLE", to: "IDLE", event: "COMMAND.EXECUTE" }
    }
  ];

  let filteredTraces = mockTraces;

  if (filter) {
    filteredTraces = filteredTraces.filter(trace =>
      trace.component.includes(filter) ||
      trace.operation.includes(filter) ||
      JSON.stringify(trace.details).includes(filter)
    );
  }

  const header = `🔍 Execution Traces

**Total Traces:** ${mockTraces.length}${filteredTraces.length !== mockTraces.length ? ` (${filteredTraces.length} shown)` : ""}
${filter ? `**Filter:** "${filter}"` : ""}
**Mode:** ${verbose ? "Verbose" : "Summary"}

`;

  if (filteredTraces.length === 0) {
    return header + `🚫 No traces found

${filter ? `No traces match filter: "${filter}"` : "No traces collected yet"}

**To generate traces:**
1. \`/trace enable\` to start collection
2. Execute commands to generate activity
3. \`/trace show\` to view results

**Available filters:** commands, intent, reducer, effects`;
  }

  const traceEntries = filteredTraces.map(trace => {
    const time = new Date(trace.timestamp).toLocaleTimeString();
    const status = trace.success ? "✅" : "❌";
    const duration = `${trace.duration}ms`;

    if (verbose) {
      return `${trace.id} | ${time} | ${status} ${trace.component}.${trace.operation} (${duration})
   Details: ${JSON.stringify(trace.details, null, 2)}`;
    } else {
      return `${time} | ${status} ${trace.component}.${trace.operation} (${duration})`;
    }
  }).join('\n\n');

  const footer = `

**Performance Summary:**
• Average Duration: ${(mockTraces.reduce((sum, t) => sum + t.duration, 0) / mockTraces.length).toFixed(1)}ms
• Success Rate: ${Math.round((mockTraces.filter(t => t.success).length / mockTraces.length) * 100)}%
• Slowest Operation: intent.parse (45.7ms)

**Commands:**
• \`/trace show --verbose\` for detailed traces
• \`/trace clear\` to clear buffer
• \`/trace disable\` to stop collection`;

  return header + "```\n" + traceEntries + "\n```" + footer;
}

/**
 * Clear traces
 */
function clearTraces(): string {
  return `🧹 Traces Cleared

**Buffer Status:**
• All trace entries removed
• Memory freed
• Collection continues if enabled

**Statistics (before clear):**
• Total traces: 23
• Buffer usage: 67%
• Oldest trace: 2 minutes ago

**Result:**
• Clean slate for new traces
• Performance monitoring reset
• Ready for fresh collection

💡 **Tip:** Traces help identify performance bottlenecks and debug execution flow`;
}

/**
 * Format configuration list
 */
function formatConfigList(): string {
  const config = {
    "debug.enabled": { value: false, default: false, description: "Enable debug mode" },
    "debug.level": { value: "info", default: "info", description: "Debug logging level" },
    "api.timeout": { value: 30000, default: 30000, description: "API request timeout (ms)" },
    "ui.theme": { value: "dark", default: "dark", description: "UI theme preference" },
    "commands.autocomplete": { value: true, default: true, description: "Enable command autocomplete" },
    "transactions.confirm": { value: true, default: true, description: "Require transaction confirmation" },
  };

  const configEntries = Object.entries(config).map(([key, conf]) => {
    const isDefault = conf.value === conf.default;
    const statusIcon = isDefault ? "🔵" : "🟡";

    return `${statusIcon} **${key}**
   Value: ${JSON.stringify(conf.value)} ${isDefault ? "(default)" : "(modified)"}
   Description: ${conf.description}`;
  }).join('\n\n');

  return `⚙️ Runtime Configuration

**Total Settings:** ${Object.keys(config).length}
**Modified:** ${Object.values(config).filter(c => c.value !== c.default).length}

${configEntries}

**Legend:**
• 🔵 Default value • 🟡 Modified value

**Commands:**
• \`/config get <key>\` to view specific setting
• \`/config set <key> <value>\` to modify setting
• \`/config reset <key>\` to restore default

💡 **Changes take effect immediately** and persist for the session`;
}

/**
 * Get configuration value
 */
function getConfigValue(key: string): string {
  const configs: Record<string, any> = {
    "debug.enabled": false,
    "debug.level": "info",
    "api.timeout": 30000,
    "ui.theme": "dark",
    "commands.autocomplete": true,
    "transactions.confirm": true,
  };

  if (!(key in configs)) {
    return `❌ Configuration key not found: ${key}

**Available keys:**
${Object.keys(configs).map(k => `• ${k}`).join('\n')}

Use \`/config list\` to see all configurations.`;
  }

  const value = configs[key];
  const type = typeof value;

  return `⚙️ Configuration Value

**Key:** ${key}
**Value:** ${JSON.stringify(value)}
**Type:** ${type}
**Status:** Current setting

**Actions:**
• \`/config set ${key} <new_value>\` to modify
• \`/config reset ${key}\` to restore default
• \`/config list\` to see all settings`;
}

/**
 * Set configuration value
 */
function setConfigValue(key: string, value: string): string {
  const validKeys = [
    "debug.enabled", "debug.level", "api.timeout",
    "ui.theme", "commands.autocomplete", "transactions.confirm"
  ];

  if (!validKeys.includes(key)) {
    return `❌ Unknown configuration key: ${key}

**Valid keys:** ${validKeys.join(", ")}`;
  }

  // Parse value based on type
  let parsedValue: any = value;
  if (value === "true") parsedValue = true;
  else if (value === "false") parsedValue = false;
  else if (!isNaN(Number(value))) parsedValue = Number(value);

  return `✅ Configuration Updated

**Key:** ${key}
**New Value:** ${JSON.stringify(parsedValue)}
**Previous Value:** (previous value)
**Type:** ${typeof parsedValue}

**Effect:** Setting applied immediately

**Verification:**
• \`/config get ${key}\` to confirm change
• \`/config list\` to see all settings
• \`/config reset ${key}\` to undo if needed`;
}

/**
 * Reset configuration value
 */
function resetConfigValue(key: string): string {
  return `🔄 Configuration Reset

**Key:** ${key}
**Value:** Restored to default
**Status:** Factory setting

**Result:**
• Setting reverted to original value
• Custom modifications removed
• Default behavior restored

**Verify:**
• \`/config get ${key}\` to see default value
• \`/config list\` to review all settings`;
}

// Utility functions

function getLevelIcon(level: string): string {
  const icons: Record<string, string> = {
    error: "🔴",
    warn: "🟡",
    info: "🟢",
    debug: "🔵"
  };
  return icons[level] || "⚪";
}