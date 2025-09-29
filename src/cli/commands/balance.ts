// Balance and portfolio commands for ExecFi CLI (Phase 2)
import type { CommandDef } from "./types";
import { parseFlags } from "./parser";
import { getChainDisplayName } from "@/lib/chains/registry";

/**
 * Multi-token balance command - shows top tokens by USD value
 */
export const balancesCmd: CommandDef = {
  name: "/balances",
  aliases: ["/bals", "/portfolio"],
  category: "core",
  summary: "Show multi-token portfolio with USD values",
  usage: "/balances [--chain <id|name>] [--limit <n>] [--sort <field>]",
  flags: [
    {
      name: "chain",
      alias: "c",
      type: "string",
      description: "Show balances for specific chain only",
    },
    {
      name: "limit",
      alias: "l",
      type: "number",
      default: 10,
      description: "Maximum number of tokens to display",
    },
    {
      name: "sort",
      alias: "s",
      type: "string",
      default: "usd",
      description: "Sort by: usd, balance, symbol (default: usd)",
    },
    {
      name: "min-usd",
      alias: "m",
      type: "number",
      default: 0.01,
      description: "Hide tokens below this USD value",
    },
  ],
  examples: [
    "/balances",
    "/balances --chain base",
    "/balances --limit 5",
    "/balances --sort symbol",
    "/bals -c ethereum -l 3",
    "/portfolio --min-usd 1.00",
  ],
  parse: (line) => {
    try {
      const flags = parseFlags(line, balancesCmd.flags);
      return { ok: true, args: flags };
    } catch (error) {
      return { ok: false, error: `Parse error: ${error}` };
    }
  },
  run: async (args, ctx, dispatch) => {
    const targetChain = args.chain || ctx.chainId || 8453;
    const chainName = getChainDisplayName(targetChain);
    const limit = args.limit || 10;
    const sortBy = args.sort || "usd";
    const minUsd = args["min-usd"] || 0.01;

    // Get the user's address
    const address =
      ctx.accountMode === "SMART_ACCOUNT"
        ? ctx.saAddress
        : ctx.selectedWallet?.address;

    if (!address) {
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ No wallet address available. Please connect a wallet first.`,
          timestamp: Date.now(),
        },
      });
      return;
    }

    // Show loading message
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `🔄 Fetching portfolio for ${address.slice(0, 6)}...${address.slice(-4)} on ${chainName}...`,
        timestamp: Date.now(),
      },
    });

    try {
      // Fetch multi-token balances (mock data for now - would integrate with actual APIs)
      const mockTokenBalances = await fetchTokenBalances(address, targetChain);

      // Filter and sort tokens
      const filteredTokens = mockTokenBalances
        .filter(token => token.usdValue >= minUsd)
        .sort((a, b) => {
          switch (sortBy) {
            case "symbol":
              return a.symbol.localeCompare(b.symbol);
            case "balance":
              return b.balance - a.balance;
            case "usd":
            default:
              return b.usdValue - a.usdValue;
          }
        })
        .slice(0, limit);

      // Calculate total portfolio value
      const totalUsdValue = filteredTokens.reduce((sum, token) => sum + token.usdValue, 0);

      // Format portfolio display
      const portfolioText = formatPortfolioDisplay(
        filteredTokens,
        totalUsdValue,
        address,
        chainName,
        targetChain
      );

      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: portfolioText,
          timestamp: Date.now(),
        },
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ Failed to fetch portfolio: ${errorMessage}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};

/**
 * Token balance interface
 */
interface TokenBalance {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  address?: string;
  decimals: number;
  logoUri?: string;
}

/**
 * Fetch token balances for an address (mock implementation)
 * In production, this would call actual balance APIs like Alchemy, Moralis, etc.
 */
async function fetchTokenBalances(_address: string, _chainId: number): Promise<TokenBalance[]> {
  // Mock data based on common Base tokens
  const mockBalances: TokenBalance[] = [
    {
      symbol: "ETH",
      name: "Ethereum",
      balance: 0.000038,
      usdValue: 0.0988, // 0.000038 * $2600
      decimals: 18,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      balance: 0,
      usdValue: 0,
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
    },
    {
      symbol: "DAI",
      name: "Dai Stablecoin",
      balance: 0,
      usdValue: 0,
      address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
      decimals: 18,
    },
    {
      symbol: "WETH",
      name: "Wrapped Ethereum",
      balance: 0,
      usdValue: 0,
      address: "0x4200000000000000000000000000000000000006",
      decimals: 18,
    },
  ];

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  return mockBalances;
}

/**
 * Format portfolio display
 */
function formatPortfolioDisplay(
  tokens: TokenBalance[],
  totalUsdValue: number,
  address: string,
  chainName: string,
  chainId: number
): string {
  const header = `💰 Portfolio Summary

**Account:** ${address.slice(0, 6)}...${address.slice(-4)}
**Chain:** ${chainName} (${chainId})
**Total Value:** $${totalUsdValue.toFixed(4)}
**Tokens:** ${tokens.length} token(s)
**Updated:** ${new Date().toLocaleTimeString()}

`;

  if (tokens.length === 0) {
    return header + `🚫 No tokens found with sufficient balance

💡 **Tips:**
• Use --min-usd to adjust minimum value filter
• Try --chain to check other networks
• Use /balance for native token only`;
  }

  const tokenRows = tokens.map((token, index) => {
    const percentage = totalUsdValue > 0 ? (token.usdValue / totalUsdValue * 100).toFixed(1) : "0.0";
    const balanceDisplay = token.balance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });

    return `${index + 1}. **${token.symbol}** (${token.name})
   Balance: ${balanceDisplay} ${token.symbol}
   USD Value: $${token.usdValue.toFixed(4)} (${percentage}%)`;
  }).join("\n\n");

  const footer = `

💡 **Quick Actions:**
• Use \`/send <amount> <token> to <address>\` to transfer tokens
• Use \`/balance --chain <name>\` to check specific chain
• Use \`/balances --sort symbol\` to sort alphabetically

⚠️  **Note:** This is a basic implementation. Production version would:
• Fetch real-time balance data from blockchain
• Include current market prices
• Support more tokens and chains
• Show transaction history and yield farming positions`;

  return header + tokenRows + footer;
}