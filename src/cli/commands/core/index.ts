// Core command implementations for ExecFi CLI
import type { CommandDef } from "../types";
import { parseSendSyntax } from "../parser";
import { getChainDisplayName } from "@/lib/chains/registry";

export const helpCmd: CommandDef = {
  name: "/help",
  aliases: ["/?"],
  category: "core",
  summary: "Show commands and usage",
  usage: "/help [command]",
  examples: ["/help", "/help /send", "/? /balances"],
  parse: (line) => {
    const parts = line.trim().split(/\s+/);
    const query = parts[1]?.toLowerCase();
    return { ok: true, args: { query } };
  },
  run: ({ query }, ctx, dispatch) => {
    if (query) {
      // Show help for specific command - simplified
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `Help for specific commands coming soon. Use /help to see all available commands.`,
          timestamp: Date.now(),
        },
      });
    } else {
      // Show general help - simplified for now
      const helpText = `📚 Available Commands

CORE COMMANDS:
  /help (/?) - Show commands and usage
  /whoami - Show current user, chain, and account info
  /balances (/balance, /bal, /bals) - Show token balances across networks
  /clear (/cls) - Clear terminal screen
  /accountinfo - Show detailed account information
  /send - Send native or ERC-20 tokens
  /chain (/network, /net) - Manage blockchain network selection
  /login (/signin, /auth) - Start authentication flow
  /logout (/signout) - Sign out of current session
  /home (/main) - Return to main terminal
  /exit (/close) - Exit current view or return to main terminal
  /cancel - Cancel current flow or operation
  /reset (/restart) - Emergency reset

ESSENTIAL COMMANDS:
  /balances (/balance, /bal, /bals) - Show all token balances across networks
  /tx <hash> - Show transaction details and status
  /txs [limit] - Show recent transaction history
  /pending - Show pending transactions

ADVANCED FEATURES:
  /policy - Configure transaction policies
  /limits - Set spending limits
  /addressbook (/contacts) - Show saved contacts and addresses
  /contact - Add new contacts

DEFI INTEGRATION (Powered by LI.FI):
  /swap <from> <to> <amount> [--chain <name>] - Execute token swaps
  /bridge <token> <amount> <to-chain> [--from-chain <name>] - Cross-chain transfers
  /quote <from> <to> <amount> [--chain <name>] - Get real-time swap quotes
  /ens <name|address> [--reverse] - Resolve ENS names to addresses

CHAIN MANAGEMENT:
  /chain list - Show all supported chains
  /chain switch <name> - Switch to a different chain
  /chain current - Show current chain status
  /chain info <name> - Show detailed chain information

💡 Natural Language Patterns:

TRANSFER (Send tokens):
  "send 0.1 ETH to vitalik.eth"
  "transfer 100 USDC to 0x123... on base"

SWAP (Same-chain token exchange):
  "swap 0.1 ETH to USDC on base"
  "swap 100 USDC to DAI"

BRIDGE (Cross-chain, same token):
  "swap 0.1 ETH on base to polygon"        ← Unified syntax
  "bridge 100 USDC from base to arbitrum"  ← Legacy syntax
  "bridge 50 DAI on optimism to ethereum"  ← Also works

BRIDGE-SWAP (Cross-chain, different tokens):
  "swap 0.1 ETH on base to USDC on polygon"
  "swap 100 USDC on arbitrum to DAI on optimism"

   Try: swap 0.001 et to usd on base`;

      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: helpText,
          timestamp: Date.now(),
        },
      });
    }

    // Command completed - no need to dispatch FLOW.COMPLETE for CLI commands
  },
};

export const whoamiCmd: CommandDef = {
  name: "/whoami",
  category: "core",
  summary: "Show current user, chain, and account info",
  usage: "/whoami",
  examples: ["/whoami"],
  parse: () => ({ ok: true, args: {} }),
  run: (args, ctx, dispatch) => {
    const accountMode = ctx.accountMode || "EOA";
    const address =
      accountMode === "SMART_ACCOUNT"
        ? ctx.saAddress
        : ctx.selectedWallet?.address;

    const chainName = getChainName(ctx.chainId);
    const userDisplay = ctx.userId ? `User: ${ctx.userId}` : "Not logged in";
    const chainDisplay = `Chain: ${chainName} (${ctx.chainId})`;
    const accountDisplay = address
      ? `${accountMode}: ${address.slice(0, 6)}...${address.slice(-4)}`
      : `${accountMode}: Not available`;

    // Output to chat history instead of overlay
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `${userDisplay}\n${chainDisplay}\n${accountDisplay}`,
        timestamp: Date.now(),
      },
    });

    // Command completed - no need to dispatch FLOW.COMPLETE for CLI commands
  },
};

export const clearCmd: CommandDef = {
  name: "/clear",
  aliases: ["/cls"],
  category: "core",
  summary: "Clear terminal screen",
  usage: "/clear",
  examples: ["/clear", "/cls"],
  parse: () => ({ ok: true, args: {} }),
  run: (args, ctx, dispatch) => {
    dispatch({
      type: "TERMINAL.CLEAR",
    });

    // Command completed - terminal cleared
  },
};

export const accountinfoCmd: CommandDef = {
  name: "/accountinfo",
  category: "core",
  summary: "Show detailed account information",
  usage: "/accountinfo",
  examples: ["/accountinfo"],
  parse: () => ({ ok: true, args: {} }),
  run: (_, ctx, dispatch) => {
    const accountMode = ctx.accountMode || "EOA";
    const address =
      accountMode === "SMART_ACCOUNT"
        ? ctx.saAddress
        : ctx.selectedWallet?.address;

    const chainName = getChainName(ctx.chainId);
    const userStatus = ctx.userId
      ? `✅ Signed in as: ${ctx.userId}`
      : "❌ Not signed in";
    const chainInfo = `Active Chain: ${chainName} (${ctx.chainId})`;
    const modeInfo = `Mode: ${accountMode}`;
    const walletInfo = address
      ? `${accountMode} Address: ${address}`
      : `${accountMode}: Not available`;

    const accountInfo = `🔑 Account Information

User:
${userStatus}

Network:
${chainInfo}
${modeInfo}

Wallet:
${walletInfo}

Quick Actions:
• Use /balances (alias: /balance) to check your token balances
• Use /send to transfer tokens
• Use /login to sign in (if not signed in)
• Use /logout to sign out (if signed in)`;

    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: accountInfo,
        timestamp: Date.now(),
      },
    });

    // Command completed - account info displayed
  },
};

export const sendCmd: CommandDef = {
  name: "/send",
  category: "core",
  summary: "Send native or ERC-20 tokens",
  usage: "/send <amount> <asset> to <address> [on <chain>]",
  examples: [
    "/send 0.1 ETH to 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "/send 100 USDC to vitalik.eth on ethereum",
    "/send 0.001 ETH to 0x123... on base",
  ],
  parse: parseSendSyntax,
  run: (args, ctx, dispatch) => {
    // Convert command to natural language and trigger existing flow
    const naturalLanguage = `send ${args.amount} ${args.symbol} to ${args.address}${
      args.chain ? ` on ${args.chain}` : ""
    }`;

    dispatch({
      type: "INPUT.SUBMIT",
      text: naturalLanguage,
    });
  },
};

export const loginCmd: CommandDef = {
  name: "/login",
  aliases: ["/signin", "/auth"],
  category: "core",
  summary: "Start authentication flow",
  usage: "/login",
  examples: ["/login", "/signin", "/auth"],
  parse: () => ({ ok: true, args: {} }),
  run: (args, ctx, dispatch) => {
    dispatch({ type: "AUTH.START" });
  },
};

export const logoutCmd: CommandDef = {
  name: "/logout",
  aliases: ["/signout"],
  category: "core",
  summary: "Sign out of current session",
  usage: "/logout",
  examples: ["/logout", "/signout"],
  parse: () => ({ ok: true, args: {} }),
  run: (args, ctx, dispatch) => {
    dispatch({ type: "AUTH.LOGOUT" });
  },
};

export const homeCmd: CommandDef = {
  name: "/home",
  aliases: ["/main"],
  category: "core",
  summary: "Return to main terminal",
  usage: "/home",
  examples: ["/home", "/main"],
  parse: () => ({ ok: true, args: {} }),
  run: (args, ctx, dispatch) => {
    dispatch({ type: "FLOW.CANCEL" });
  },
};

export const exitCmd: CommandDef = {
  name: "/exit",
  aliases: ["/close"],
  category: "core",
  summary: "Exit current view or return to main terminal",
  usage: "/exit",
  examples: ["/exit", "/close"],
  parse: () => ({ ok: true, args: {} }),
  run: (args, ctx, dispatch) => {
    dispatch({ type: "NAV.VIEW.POP" });
  },
};

export const cancelCmd: CommandDef = {
  name: "/cancel",
  category: "core",
  summary: "Cancel current flow or operation",
  usage: "/cancel",
  examples: ["/cancel"],
  parse: () => ({ ok: true, args: {} }),
  run: (args, ctx, dispatch) => {
    dispatch({ type: "FLOW.CANCEL" });
  },
};

export const resetCmd: CommandDef = {
  name: "/reset",
  aliases: ["/restart"],
  category: "core",
  summary: "Emergency reset - clear everything and return to main terminal",
  usage: "/reset",
  examples: ["/reset", "/restart"],
  parse: () => ({ ok: true, args: {} }),
  run: (args, ctx, dispatch) => {
    dispatch({ type: "APP.RESET" });
  },
};

// Utility function to get chain name from ID
function getChainName(chainId: number | string): string {
  if (typeof chainId === "string") return chainId;
  return getChainDisplayName(chainId);
}
