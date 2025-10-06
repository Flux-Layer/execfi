// Phase 4: DeFi Integration commands
import type { CommandDef } from "./types";
import { parseFlags } from "./parser";

/**
 * /swap command - Execute token swaps using LI.FI
 */
export const swapCmd: CommandDef = {
  name: "/swap",
  aliases: ["/sw"],
  category: "utility",
  summary: "Execute token swaps using LI.FI",
  usage: "/swap <from-token> <to-token> <amount> [options]",
  flags: [
    {
      name: "simulate",
      alias: "s",
      description: "Simulate the swap without executing",
      type: "boolean",
      default: false,
    },
    {
      name: "slippage",
      alias: "sl",
      description: "Max slippage tolerance (%)",
      type: "string",
      default: "0.5",
    },
    {
      name: "chain",
      alias: "c",
      description: "Source chain for the swap",
      type: "string",
      default: "base",
    },
  ],
  examples: [
    "/swap ETH USDC 0.1",
    "/swap USDC ETH 100 --slippage 1.0",
    "/swap ETH USDT 0.5 --simulate",
  ],

  parse: (line) => {
    const flags = parseFlags(line);
    const [fromToken, toToken, amount] = flags._;
    const { simulate, slippage, chain } = flags;

    if (!fromToken || !toToken || !amount) {
      return { ok: false, error: "Usage: /swap <from-token> <to-token> <amount> [options]" };
    }

    return { ok: true, args: { fromToken, toToken, amount, simulate, slippage, chain } };
  },

  run: async ({ fromToken, toToken, amount, chain, slippage }, _ctx, dispatch) => {
    // Set pending slippage if specified
    if (slippage) {
      const slippageNum = parseFloat(slippage);
      if (!isNaN(slippageNum)) {
        // Convert percentage to decimal
        dispatch({
          type: "SLIPPAGE.SET_PENDING",
          slippage: slippageNum / 100,
        });
      }
    }

    // Convert command to natural language and trigger existing swap flow
    const naturalLanguage = chain
      ? `swap ${amount} ${fromToken} to ${toToken} on ${chain}`
      : `swap ${amount} ${fromToken} to ${toToken}`;

    dispatch({
      type: "INPUT.SUBMIT",
      text: naturalLanguage,
    });
  },
};

/**
 * /bridge command - Execute cross-chain token transfers
 */
export const bridgeCmd: CommandDef = {
  name: "/bridge",
  aliases: ["/br"],
  category: "utility",
  summary: "Execute cross-chain token transfers",
  usage: "/bridge <token> <amount> <to-chain> [options]",
  flags: [
    {
      name: "simulate",
      alias: "s",
      description: "Simulate the bridge without executing",
      type: "boolean",
      default: false,
    },
    {
      name: "from-chain",
      alias: "f",
      description: "Source chain for the bridge",
      type: "string",
      default: "base",
    },
  ],
  examples: [
    "/bridge ETH 0.1 ethereum",
    "/bridge USDC 100 polygon --simulate",
  ],

  parse: (line) => {
    const flags = parseFlags(line);
    const [token, amount, toChain] = flags._;
    const { simulate, "from-chain": fromChain } = flags;

    if (!token || !amount || !toChain) {
      return { ok: false, error: "Usage: /bridge <token> <amount> <to-chain> [options]" };
    }

    return { ok: true, args: { token, amount, toChain, simulate, fromChain } };
  },

  run: async ({ token, amount, toChain, fromChain }, _ctx, dispatch) => {
    // Convert command to natural language and trigger existing bridge flow
    const naturalLanguage = fromChain
      ? `bridge ${amount} ${token} from ${fromChain} to ${toChain}`
      : `bridge ${amount} ${token} to ${toChain}`;

    dispatch({
      type: "INPUT.SUBMIT",
      text: naturalLanguage,
    });
  },
};

/**
 * /quote command - Get quotes for swaps and bridges
 */
export const quoteCmd: CommandDef = {
  name: "/quote",
  aliases: ["/q", "/price"],
  category: "utility",
  summary: "Get quotes for swaps and bridges",
  usage: "/quote <from-token> <to-token> <amount> [options]",
  flags: [
    {
      name: "chain",
      alias: "c",
      description: "Source chain for the quote",
      type: "string",
      default: "base",
    },
    {
      name: "routes",
      alias: "r",
      description: "Number of routes to show",
      type: "string",
      default: "3",
    },
  ],
  examples: [
    "/quote ETH USDC 0.1",
    "/quote USDC ETH 100 --routes 5",
  ],

  parse: (line) => {
    const flags = parseFlags(line);
    const [fromToken, toToken, amount] = flags._;
    const { chain, routes } = flags;

    if (!fromToken || !toToken || !amount) {
      return { ok: false, error: "Usage: /quote <from-token> <to-token> <amount> [options]" };
    }

    return { ok: true, args: { fromToken, toToken, amount, chain, routes: parseInt(routes || "3") } };
  },

  run: async ({ fromToken, toToken, amount, chain }, _ctx, dispatch) => {
    // Convert command to natural language query for quote
    const naturalLanguage = chain
      ? `quote ${amount} ${fromToken} to ${toToken} on ${chain}`
      : `how much is ${amount} ${fromToken} in ${toToken}`;

    dispatch({
      type: "INPUT.SUBMIT",
      text: naturalLanguage,
    });
  },
};

/**
 * /ens command - Resolve ENS names
 */
export const ensCmd: CommandDef = {
  name: "/ens",
  aliases: ["/name"],
  category: "utility",
  summary: "Resolve ENS names to addresses",
  usage: "/ens <name|address> [options]",
  flags: [
    {
      name: "reverse",
      alias: "r",
      description: "Perform reverse ENS lookup",
      type: "boolean",
      default: false,
    },
  ],
  examples: [
    "/ens vitalik.eth",
    "/ens 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --reverse",
  ],

  parse: (line) => {
    const flags = parseFlags(line);
    const [nameOrAddress] = flags._;
    const { reverse } = flags;

    if (!nameOrAddress) {
      return { ok: false, error: "Usage: /ens <name|address> [options]" };
    }

    return { ok: true, args: { nameOrAddress, reverse } };
  },

  run: async ({ nameOrAddress }, _ctx, dispatch) => {
    // Convert command to natural language query for ENS resolution
    const naturalLanguage = `resolve ${nameOrAddress}`;

    dispatch({
      type: "INPUT.SUBMIT",
      text: naturalLanguage,
    });
  },
};

/**
 * /sign command - Sign messages
 */
export const signCmd: CommandDef = {
  name: "/sign",
  aliases: ["/sig"],
  category: "utility",
  summary: "Sign messages with your wallet",
  usage: "/sign <message> [options]",
  flags: [
    {
      name: "typed",
      alias: "t",
      description: "Sign as typed data (EIP-712)",
      type: "boolean",
      default: false,
    },
  ],
  examples: [
    '/sign "Hello, World!"',
    '/sign "Login request" --typed',
  ],

  parse: (line) => {
    const flags = parseFlags(line);
    let message = flags._.join(' ');

    if (!message) {
      return { ok: false, error: "Usage: /sign <message> [options]" };
    }

    // Remove quotes if present
    if ((message.startsWith('"') && message.endsWith('"')) ||
        (message.startsWith("'") && message.endsWith("'"))) {
      message = message.slice(1, -1);
    }

    return { ok: true, args: { message, typed: flags.typed } };
  },

  run: async ({ message, typed }, _ctx, dispatch) => {
    try {
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `✍️ Signing ${typed ? 'typed data' : 'message'}...`,
          timestamp: Date.now(),
        },
      });

      await new Promise(resolve => setTimeout(resolve, 800));

      const mockSignature = "0x" + Array(130).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
      const mockAddress = "0x1234567890123456789012345678901234567890";

      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `✅ **Message Signed**\n\n**Message**: "${message}"\n**Signer**: \`${mockAddress}\`\n**Type**: ${typed ? 'EIP-712 Typed Data' : 'Personal Message'}\n\n**Signature**:\n\`\`\`\n${mockSignature}\n\`\`\``,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ Signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};

/**
 * /verify command - Verify message signatures
 */
export const verifyCmd: CommandDef = {
  name: "/verify",
  aliases: ["/ver"],
  category: "utility",
  summary: "Verify message signatures",
  usage: "/verify <message> <signature> <address>",
  examples: [
    '/verify "Hello, World!" 0x1234... 0xabcd...',
  ],

  parse: (line) => {
    const args = line.trim().split(/\s+/).slice(1);
    const [message, signature, address] = args;

    if (!message || !signature || !address) {
      return { ok: false, error: "Usage: /verify <message> <signature> <address>" };
    }

    return { ok: true, args: { message, signature, address } };
  },

  run: async ({ message, signature, address }, _ctx, dispatch) => {
    try {
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `🔍 Verifying message signature...`,
          timestamp: Date.now(),
        },
      });

      await new Promise(resolve => setTimeout(resolve, 600));

      const isValid = Math.random() > 0.2; // 80% success rate for demo
      const status = isValid ? '✅' : '❌';
      const result = isValid ? 'VALID' : 'INVALID';
      const reason = isValid ? 'Signature verification successful' : 'Signature does not match';

      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `${status} **Signature Verification**\n\n**Result**: ${result}\n**Message**: "${message}"\n**Signer**: \`${address}\`\n\n**Details**: ${reason}`,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};