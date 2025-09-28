// Chain management commands for ExecFi CLI
import type { CommandDef } from "./types";
import { parseFlags } from "./parser";
import {
  getSupportedChains,
  getMainnetChains,
  getTestnetChains,
  getChainDisplayName,
  resolveChain,
  type ChainConfig
} from "@/lib/chains/registry";

/**
 * Parse chain command syntax
 */
function parseChainCommand(line: string): { ok: true; args: Record<string, any> } | { ok: false; error: string } {
  const parts = line.trim().split(/\s+/);
  const subcommand = parts[1]?.toLowerCase();

  switch (subcommand) {
    case "list":
    case "ls":
      const flags = parseFlags(line.substring(line.indexOf(subcommand) + subcommand.length), chainCmd.flags);
      return { ok: true, args: { action: "list", ...flags } };

    case "switch":
    case "set":
      if (parts.length < 3) {
        return { ok: false, error: "Missing chain name/ID. Usage: /chain switch <name|id>" };
      }
      const chainInput = parts.slice(2).join(" ");
      return { ok: true, args: { action: "switch", chain: chainInput } };

    case "current":
    case "status":
      return { ok: true, args: { action: "current" } };

    case "info":
      if (parts.length < 3) {
        return { ok: false, error: "Missing chain name/ID. Usage: /chain info <name|id>" };
      }
      const infoChain = parts.slice(2).join(" ");
      return { ok: true, args: { action: "info", chain: infoChain } };

    default:
      if (!subcommand) {
        // Default to current status
        return { ok: true, args: { action: "current" } };
      }
      return { ok: false, error: `Unknown subcommand: ${subcommand}. Use: list, switch, current, info` };
  }
}

/**
 * Format chain list for display
 */
function formatChainList(chains: ChainConfig[], includeTestnets: boolean): string {
  const mainnets = chains.filter(c => !c.isTestnet);
  const testnets = chains.filter(c => c.isTestnet);

  let output = "🔗 Supported Chains:\n\n";

  if (mainnets.length > 0) {
    output += "**Mainnets:**\n";
    mainnets.forEach(chain => {
      const indicator = chain.id === 8453 ? " [default]" : "";
      output += `  • ${chain.name} (${chain.id})${indicator}\n`;
    });
  }

  if (includeTestnets && testnets.length > 0) {
    output += "\n**Testnets:**\n";
    testnets.forEach(chain => {
      output += `  • ${chain.name} (${chain.id})\n`;
    });
  }

  output += "\n💡 Use '/chain switch <name>' to change chains";
  output += "\n💡 Use '/chain info <name>' for detailed chain information";

  return output;
}

/**
 * Format detailed chain information
 */
function formatChainInfo(chain: ChainConfig): string {
  return `🔗 Chain Information: ${chain.name}

**Basic Details:**
• Name: ${chain.name}
• Chain ID: ${chain.id}
• Symbol: ${chain.symbol}
• Type: ${chain.isTestnet ? "Testnet" : "Mainnet"}

**Network Details:**
• Native Currency: ${chain.nativeCurrency.name} (${chain.nativeCurrency.symbol})
• Decimals: ${chain.nativeCurrency.decimals}
• RPC URL: ${chain.rpcUrl}
• Explorer: ${chain.explorerName} (${chain.explorerUrl})

**Tokens Available:** ${chain.tokens.length} token(s)
${chain.tokens.map(token => `  • ${token.name} (${token.symbol})`).join("\n")}

**Status:** ${chain.supported ? "✅ Supported" : "❌ Not supported"}

💡 Use '/chain switch ${chain.name.toLowerCase()}' to switch to this chain`;
}

export const chainCmd: CommandDef = {
  name: "/chain",
  aliases: ["/network", "/net"],
  category: "core",
  summary: "Manage blockchain network selection",
  usage: "/chain [list|switch|current|info] [options]",
  flags: [
    {
      name: "testnets",
      alias: "t",
      type: "boolean",
      default: false,
      description: "Include testnets in list output",
    },
    {
      name: "all",
      alias: "a",
      type: "boolean",
      default: false,
      description: "Show all supported chains (including testnets)",
    }
  ],
  examples: [
    "/chain",
    "/chain list",
    "/chain list --testnets",
    "/chain switch base",
    "/chain switch ethereum",
    "/chain switch 8453",
    "/chain current",
    "/chain info base",
    "/network ls -t",
    "/net switch polygon"
  ],
  parse: parseChainCommand,
  run: async (args, ctx, dispatch) => {
    const action = args.action || "current";

    try {
      switch (action) {
        case "list": {
          const includeTestnets = args.testnets || args.all;
          const chains = getSupportedChains();
          const listText = formatChainList(chains, includeTestnets);

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

        case "switch": {
          const chainInput = args.chain;
          if (!chainInput) {
            dispatch({
              type: "CHAT.ADD",
              message: {
                role: "assistant",
                content: "❌ Missing chain name/ID. Usage: /chain switch <name|id>",
                timestamp: Date.now(),
              },
            });
            break;
          }

          try {
            // Resolve the chain first to validate it
            const targetChain = resolveChain(chainInput);

            // Access chain selection context through window (temporary approach)
            // In production, this would be passed through CLI context
            const chainSwitchSuccess = await new Promise<boolean>((resolve) => {
              // Emit a custom event that the chain selection provider can listen to
              window.dispatchEvent(new CustomEvent('chain-switch-request', {
                detail: { chainId: targetChain.id, resolve }
              }));
            });

            if (chainSwitchSuccess) {
              dispatch({
                type: "CHAT.ADD",
                message: {
                  role: "assistant",
                  content: `✅ Switched to ${targetChain.name} (${targetChain.id})`,
                  timestamp: Date.now(),
                },
              });
            } else {
              dispatch({
                type: "CHAT.ADD",
                message: {
                  role: "assistant",
                  content: `❌ Failed to switch to ${targetChain.name}. Please try again.`,
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
                content: `❌ ${errorMessage}`,
                timestamp: Date.now(),
              },
            });
          }
          break;
        }

        case "current": {
          const currentChainId = ctx.chainId || 8453; // Default to Base
          const currentChain = getSupportedChains().find(c => c.id === currentChainId);

          if (currentChain) {
            const statusText = `🔗 Current Chain: ${currentChain.name} (${currentChain.id})
• Type: ${currentChain.isTestnet ? "Testnet" : "Mainnet"}
• Native Token: ${currentChain.nativeCurrency.symbol}
• Explorer: ${currentChain.explorerName}

💡 Use '/chain list' to see all available chains
💡 Use '/chain switch <name>' to change chains`;

            dispatch({
              type: "CHAT.ADD",
              message: {
                role: "assistant",
                content: statusText,
                timestamp: Date.now(),
              },
            });
          } else {
            dispatch({
              type: "CHAT.ADD",
              message: {
                role: "assistant",
                content: `❌ Current chain ${currentChainId} not found in registry`,
                timestamp: Date.now(),
              },
            });
          }
          break;
        }

        case "info": {
          const chainInput = args.chain;
          if (!chainInput) {
            dispatch({
              type: "CHAT.ADD",
              message: {
                role: "assistant",
                content: "❌ Missing chain name/ID. Usage: /chain info <name|id>",
                timestamp: Date.now(),
              },
            });
            break;
          }

          try {
            const chain = resolveChain(chainInput);
            const infoText = formatChainInfo(chain);

            dispatch({
              type: "CHAT.ADD",
              message: {
                role: "assistant",
                content: infoText,
                timestamp: Date.now(),
              },
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            dispatch({
              type: "CHAT.ADD",
              message: {
                role: "assistant",
                content: `❌ ${errorMessage}`,
                timestamp: Date.now(),
              },
            });
          }
          break;
        }

        default: {
          dispatch({
            type: "CHAT.ADD",
            message: {
              role: "assistant",
              content: `❌ Unknown action: ${action}. Use: list, switch, current, info`,
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
          content: `❌ Chain command error: ${errorMessage}`,
          timestamp: Date.now(),
        },
      });
    }

    // Complete the flow and return to main terminal
    dispatch({ type: "FLOW.COMPLETE" });
  },
};