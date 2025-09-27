// Command system type definitions for ExecFi CLI
import type { CoreContext, AppEvent } from "../state/types";

export type FlagDef = {
  name: string;
  alias?: string;
  type: "string" | "number" | "boolean";
  default?: unknown;
  description: string;
};

export type CommandCategory = "core" | "utility" | "dev";

export type CommandResult =
  | { ok: true; args: Record<string, any> }
  | { ok: false; error: string };

export type CommandDef = {
  name: string;
  aliases?: string[];
  summary: string;
  usage: string;
  flags?: FlagDef[];
  category: CommandCategory;
  examples?: string[];
  parse: (input: string) => CommandResult;
  run: (args: Record<string, any>, ctx: CoreContext, dispatch: (e: AppEvent) => void) => void | Promise<void>;
};

export type CommandRegistry = {
  commands: CommandDef[];
  aliases: Map<string, string>; // alias -> command name
};

// Command execution context
export type CommandContext = {
  command: string;
  args: Record<string, any>;
  timestamp: number;
};

// Flag parsing result
export type ParsedFlags = {
  _: string[]; // positional arguments
  [key: string]: any; // named flags
};