// Command registry and router for ExecFi CLI
import type { CommandDef, CommandRegistry } from "./types";
import * as CoreCommands from "./core";
import { chainCmd } from "./chain";
import { balancesCmd } from "./balance";
import { txCmd, txsCmd, pendingCmd } from "./transaction";
import { sessionCmd, policyCmd, limitsCmd } from "./session";
import { approveCmd, allowancesCmd, revokeCmd } from "./token";
import { addressbookCmd, contactAddCmd } from "./contact";
import { stateCmd, logsCmd, traceCmd, configCmd } from "./developer";
import { swapCmd, bridgeCmd, quoteCmd, ensCmd, signCmd, verifyCmd } from "./phase4";

// Build the command registry
export const COMMANDS: CommandDef[] = [
  // Core commands (Phase 1)
  CoreCommands.helpCmd,
  CoreCommands.whoamiCmd,
  CoreCommands.balanceCmd,
  CoreCommands.clearCmd,
  CoreCommands.accountinfoCmd,
  CoreCommands.sendCmd,
  CoreCommands.loginCmd,
  CoreCommands.logoutCmd,
  CoreCommands.homeCmd,
  CoreCommands.exitCmd,
  CoreCommands.cancelCmd,
  CoreCommands.resetCmd,
  chainCmd,

  // Essential commands (Phase 2)
  balancesCmd,
  txCmd,
  txsCmd,
  pendingCmd,

  // Advanced features (Phase 3)
  sessionCmd,
  policyCmd,
  limitsCmd,
  approveCmd,
  allowancesCmd,
  revokeCmd,
  addressbookCmd,
  contactAddCmd,
  stateCmd,
  logsCmd,
  traceCmd,
  configCmd,

  // DeFi Integration (Phase 4)
  swapCmd,
  bridgeCmd,
  quoteCmd,
  ensCmd,
  signCmd,
  verifyCmd,
];

// Build alias map for fast lookup
const buildAliasMap = (commands: CommandDef[]): Map<string, string> => {
  const map = new Map<string, string>();

  for (const cmd of commands) {
    // Add main command name
    map.set(cmd.name, cmd.name);

    // Add aliases
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        map.set(alias, cmd.name);
      }
    }
  }

  return map;
};

export const COMMAND_REGISTRY: CommandRegistry = {
  commands: COMMANDS,
  aliases: buildAliasMap(COMMANDS),
};

/**
 * Route a command line to the appropriate command definition
 */
export function routeCommand(line: string): CommandDef | undefined {
  if (!line.trim()) return undefined;

  const commandName = line.trim().split(/\s+/)[0].toLowerCase();

  // Check if it's a command (starts with /)
  if (!commandName.startsWith('/')) {
    return undefined;
  }

  // Look up by name or alias
  const targetName = COMMAND_REGISTRY.aliases.get(commandName);
  if (!targetName) {
    return undefined;
  }

  return COMMAND_REGISTRY.commands.find(cmd => cmd.name === targetName);
}

/**
 * Get all commands by category
 */
export function getCommandsByCategory(category: string): CommandDef[] {
  return COMMAND_REGISTRY.commands.filter(cmd => cmd.category === category);
}

/**
 * Get command help text
 */
export function getCommandHelp(commandName: string): string | undefined {
  const cmd = COMMAND_REGISTRY.commands.find(c =>
    c.name === commandName || c.aliases?.includes(commandName)
  );

  if (!cmd) return undefined;

  let help = `${cmd.name} - ${cmd.summary}\n\n`;
  help += `Usage: ${cmd.usage}\n\n`;

  if (cmd.aliases && cmd.aliases.length > 0) {
    help += `Aliases: ${cmd.aliases.join(', ')}\n\n`;
  }

  if (cmd.flags && cmd.flags.length > 0) {
    help += `Flags:\n`;
    for (const flag of cmd.flags) {
      const aliasText = flag.alias ? `, -${flag.alias}` : '';
      const defaultText = flag.default !== undefined ? ` (default: ${flag.default})` : '';
      help += `  --${flag.name}${aliasText}: ${flag.description}${defaultText}\n`;
    }
    help += '\n';
  }

  if (cmd.examples && cmd.examples.length > 0) {
    help += `Examples:\n`;
    for (const example of cmd.examples) {
      help += `  ${example}\n`;
    }
  }

  return help;
}

/**
 * Get all available commands for help display
 */
export function getAllCommands(): CommandDef[] {
  return COMMAND_REGISTRY.commands;
}

/**
 * Check if input looks like a command
 */
export function isCommand(input: string): boolean {
  return input.trim().startsWith('/');
}

/**
 * Suggest similar commands for typos
 */
export function suggestCommands(input: string): string[] {
  const commandName = input.trim().split(/\s+/)[0].toLowerCase();
  const suggestions: string[] = [];

  // Simple similarity check - commands that start with similar letters
  for (const [alias, name] of COMMAND_REGISTRY.aliases.entries()) {
    if (alias.startsWith(commandName.substring(0, 3))) {
      if (!suggestions.includes(name)) {
        suggestions.push(name);
      }
    }
  }

  return suggestions.slice(0, 3); // Return top 3 suggestions
}