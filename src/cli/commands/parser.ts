// Flag parsing utilities for CLI commands
import type { FlagDef, ParsedFlags } from "./types";

/**
 * Simple flag parser for command line arguments
 * Supports: --flag value, --flag=value, -f value, -f=value
 */
export function parseFlags(input: string, flagDefs: FlagDef[] = []): ParsedFlags {
  const tokens = tokenize(input);
  const result: ParsedFlags = { _: [] };

  // Set defaults from flag definitions
  for (const flagDef of flagDefs) {
    if (flagDef.default !== undefined) {
      result[flagDef.name] = flagDef.default;
    }
  }

  let i = 1; // Skip command name
  while (i < tokens.length) {
    const token = tokens[i];

    if (token.startsWith('--')) {
      // Long flag: --flag or --flag=value
      const [flagName, value] = token.substring(2).split('=', 2);
      if (value !== undefined) {
        result[flagName] = coerceValue(value, getFlagType(flagName, flagDefs));
      } else if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        result[flagName] = coerceValue(tokens[i + 1], getFlagType(flagName, flagDefs));
        i++; // Skip next token
      } else {
        result[flagName] = true; // Boolean flag
      }
    } else if (token.startsWith('-') && token.length > 1) {
      // Short flag: -f or -f=value
      const [flagAlias, value] = token.substring(1).split('=', 2);
      const flagName = resolveFlagAlias(flagAlias, flagDefs);

      if (value !== undefined) {
        result[flagName] = coerceValue(value, getFlagType(flagName, flagDefs));
      } else if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        result[flagName] = coerceValue(tokens[i + 1], getFlagType(flagName, flagDefs));
        i++; // Skip next token
      } else {
        result[flagName] = true; // Boolean flag
      }
    } else {
      // Positional argument
      result._.push(token);
    }

    i++;
  }

  return result;
}

/**
 * Tokenize input string, respecting quotes
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Get flag type from definitions
 */
function getFlagType(flagName: string, flagDefs: FlagDef[]): string {
  const def = flagDefs.find(f => f.name === flagName);
  return def?.type || 'string';
}

/**
 * Resolve flag alias to full name
 */
function resolveFlagAlias(alias: string, flagDefs: FlagDef[]): string {
  const def = flagDefs.find(f => f.alias === alias);
  return def?.name || alias;
}

/**
 * Coerce string value to appropriate type
 */
function coerceValue(value: string, type: string): any {
  switch (type) {
    case 'number':
      const num = Number(value);
      return isNaN(num) ? value : num;
    case 'boolean':
      return value.toLowerCase() === 'true' || value === '1';
    default:
      return value;
  }
}

/**
 * Parse simple send command syntax: /send <amount> <asset> to <address> [on <chain>]
 */
export function parseSendSyntax(input: string): {
  ok: true;
  args: { amount: string; symbol: string; address: string; chain?: string }
} | {
  ok: false;
  error: string
} {
  // Remove command name and normalize whitespace
  const normalized = input.replace(/^\/send\s+/i, '').trim();

  // Pattern: <amount> <asset> to <address> [on <chain>]
  const sendPattern = /^(.+?)\s+(\w+)\s+to\s+([^\s]+)(?:\s+on\s+(.+))?$/i;
  const match = normalized.match(sendPattern);

  if (!match) {
    return {
      ok: false,
      error: "Invalid syntax. Use: /send <amount> <asset> to <address> [on <chain>]"
    };
  }

  const [, amount, symbol, address, chain] = match;

  return {
    ok: true,
    args: {
      amount: amount.trim(),
      symbol: symbol.trim().toUpperCase(),
      address: address.trim(),
      chain: chain?.trim()
    }
  };
}