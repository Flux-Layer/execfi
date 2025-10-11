// Balance and portfolio commands for ExecFi CLI (Phase 2)
import type { CommandDef } from "./types";
import { parseFlags } from "./parser";
// Removed unused import: getChainDisplayName
import {
  fetchPortfolioSnapshot,
  fetchPortfolioSummary,
  type PortfolioToken,
  type PortfolioSummary,
  type AggregatedToken
} from "@/services/portfolioService";
import { resolveChainIds, formatChainLabel, getSupportedMainnetChainIds } from "@/lib/utils/chain";
import { formatUSDValue, formatUSDCompact } from "@/lib/utils";
import { getActiveWalletAddress, getActiveWallet } from "../utils/getActiveWallet";

/**
 * Multi-token balance command - shows top tokens by USD value
 */
export const balancesCmd: CommandDef = {
  name: "/balances",
  aliases: ["/balance", "/bal", "/bals", "/portfolio"],
  category: "core",
  summary: "Show multi-token portfolio with USD values",
  usage: "/balances [--chain <id|name>] [--limit <n>] [--sort <field>] [--summary|--detailed] [--insights]",
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
    {
      name: "summary",
      alias: "S",
      type: "boolean",
      default: true,
      description: "Show unified portfolio summary (default)",
    },
    {
      name: "detailed",
      alias: "D",
      type: "boolean",
      description: "Show per-chain token breakdown",
    },
    {
      name: "insights",
      alias: "I",
      type: "boolean",
      description: "Include portfolio insights and recommendations",
    },
    {
      name: "aggregate",
      alias: "A",
      type: "boolean",
      default: true,
      description: "Group same tokens across chains (default)",
    },
  ],
  examples: [
    "/balances",
    "/balances --summary --insights",
    "/balances --detailed --chain base",
    "/balances --limit 5 --sort symbol",
    "/bals -c ethereum -l 3 -I",
    "/portfolio --min-usd 1.00 --aggregate",
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
    const limit = args.limit || 10;
    const sortBy = args.sort || "usd";
    const minUsd = args["min-usd"] || 0.01;

    // Determine display mode (default to summary unless detailed explicitly requested)
    const showDetailed = args.detailed === true;
    const showInsights = args.insights === true;
    const useAggregation = args.aggregate !== false; // Default true

    // Resolve chain IDs from --chain flag or use all supported chains for summary mode
    const defaultChainId = ctx.chainId || 8453;
    let resolvedChainIds: number[];

    if (args.chain) {
      // User specified chains explicitly
      resolvedChainIds = resolveChainIds(args.chain, defaultChainId);
    } else if (showDetailed || !useAggregation) {
      // Detailed mode uses current chain only
      resolvedChainIds = [defaultChainId];
    } else {
      // Summary mode uses all supported mainnet chains for portfolio aggregation
      resolvedChainIds = getSupportedMainnetChainIds();
    }

    // Get the active wallet address based on current account mode
    const activeWallet = getActiveWallet(ctx);
    const address = activeWallet.address;

    if (!address) {
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ No wallet address available for ${activeWallet.label}. Please connect a wallet first.`,
          timestamp: Date.now(),
        },
      });
      return;
    }

    // Build chain display names
    const chainDisplayNames = resolvedChainIds.map(id => formatChainLabel(id));
    const chainSummary = chainDisplayNames.length === 1
      ? chainDisplayNames[0]
      : `${chainDisplayNames.length} chains (${chainDisplayNames.slice(0, 2).join(', ')}${chainDisplayNames.length > 2 ? ', ...' : ''})`;

    // Show loading message
    dispatch({
      type: "CHAT.ADD",
      message: {
        role: "assistant",
        content: `🔄 Fetching portfolio for ${address.slice(0, 6)}...${address.slice(-4)} on ${chainSummary}...`,
        timestamp: Date.now(),
      },
    });

    try {
      if (showDetailed || !useAggregation) {
        // Use original detailed view
        const { tokens } = await fetchPortfolioSnapshot({
          address: address as `0x${string}`,
          chainIds: resolvedChainIds
        });

        // Filter and sort tokens
        const filteredTokens = tokens
          .filter(token => {
            if (token.priceUsd !== undefined) {
              return token.usdValue >= minUsd;
            }
            return parseFloat(token.formattedAmount) > 0;
          })
          .sort((a, b) => {
            switch (sortBy) {
              case "symbol":
                return a.symbol.localeCompare(b.symbol);
              case "balance":
                return parseFloat(b.formattedAmount) - parseFloat(a.formattedAmount);
              case "usd":
              default:
                return b.usdValue - a.usdValue;
            }
          })
          .slice(0, limit);

        const totalUsdValue = filteredTokens
          .filter(token => token.priceUsd !== undefined)
          .reduce((sum, token) => sum + token.usdValue, 0);

        const portfolioText = formatDetailedPortfolioDisplay(
          filteredTokens,
          totalUsdValue,
          address as `0x${string}`,
          resolvedChainIds,
          chainDisplayNames
        );

        dispatch({
          type: "CHAT.ADD",
          message: {
            role: "assistant",
            content: portfolioText,
            timestamp: Date.now(),
          },
        });
      } else {
        // Use new summary view with aggregation
        const portfolioSummary = await fetchPortfolioSummary({
          address: address as `0x${string}`,
          chainIds: resolvedChainIds
        });

        // Apply filters to aggregated tokens
        const filteredHoldings = portfolioSummary.topHoldings
          .filter(token => {
            if (token.priceUsd !== undefined) {
              return token.totalUsdValue >= minUsd;
            }
            return parseFloat(token.totalBalance) > 0;
          })
          .sort((a, b) => {
            switch (sortBy) {
              case "symbol":
                return a.symbol.localeCompare(b.symbol);
              case "balance":
                return parseFloat(b.totalBalance) - parseFloat(a.totalBalance);
              case "usd":
              default:
                return b.totalUsdValue - a.totalUsdValue;
            }
          })
          .slice(0, limit);

        const portfolioText = formatPortfolioSummaryDisplay(
          portfolioSummary,
          filteredHoldings,
          showInsights
        );

        dispatch({
          type: "CHAT.ADD",
          message: {
            role: "assistant",
            content: portfolioText,
            timestamp: Date.now(),
          },
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      let errorContent = `❌ Failed to fetch portfolio: ${errorMessage}`;

      if (errorMessage.includes('LiFi') && errorMessage.includes('RPC')) {
        errorContent += `\n\n💡 **Troubleshooting:**\n• Check your internet connection\n• Verify RPC endpoints are accessible\n• Consider setting NEXT_PUBLIC_LIFI_API_KEY environment variable`;
      } else if (errorMessage.includes('LiFi')) {
        errorContent += `\n\n💡 **Note:** LiFi API issue detected. Try again or check your network connection.`;
      }

      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: errorContent,
          timestamp: Date.now(),
        },
      });
    }
  },
};

/**
 * Detailed portfolio display formatter (per-token, per-chain)
 */
function formatDetailedPortfolioDisplay(
  tokens: PortfolioToken[],
  totalUsdValue: number,
  address: `0x${string}`,
  chainIds: number[],
  chainNames: string[]
): string {
  const now = new Date();
  const chainSummary = chainIds.length === 1
    ? `**Chain:** ${chainNames[0]} (${chainIds[0]})`
    : `**Chains:** ${chainNames.length} chains (${chainIds.join(', ')})`;

  const header = `💰 Portfolio Summary

**Account:** ${address.slice(0, 6)}...${address.slice(-4)}
${chainSummary}
**Total Value:** ${formatUSDValue(totalUsdValue, 'high')}
**Tokens:** ${tokens.length} token(s)
**Updated:** ${now.toLocaleTimeString()}

`;

  if (tokens.length === 0) {
    return header + `🚫 No tokens found with sufficient balance

💡 **Tips:**
• Use --min-usd to adjust minimum value filter
• Try --chain to check other networks (e.g., --chain ethereum,polygon)
• Run /balances --detailed for a chain-by-chain check
• Ensure your wallet has tokens on the selected chain(s)`;
  }

  const tokenRows = tokens.map((token, index) => {
    const percentage = totalUsdValue > 0 ? (token.usdValue / totalUsdValue * 100).toFixed(1) : "0.0";

    // Format balance with appropriate precision
    const balanceDisplay = parseFloat(token.formattedAmount).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    });

    // Show chain label if multi-chain
    const chainLabel = chainIds.length > 1 ? ` (${token.chainName})` : '';

    // Handle price availability
    const priceInfo = token.priceUsd !== undefined
      ? `USD Value: ${formatUSDValue(token.usdValue, 'medium')} (${percentage}%)`
      : `USD Value: (price unavailable)`;

    return `${index + 1}. **${token.symbol}**${chainLabel} (${token.name})
   Balance: ${balanceDisplay} ${token.symbol}
   ${priceInfo}`;
  }).join("\n\n");

  const hasUnpricedTokens = tokens.some(token => token.priceUsd === undefined);
  const priceNote = hasUnpricedTokens
    ? `⚠️  Some tokens show "(price unavailable)" - total may be incomplete\n`
    : '';

  const footer = `

💡 **Quick Actions:**
• Use \`/send <amount> <token> to <address>\` to transfer tokens
• Use \`/balances\` for multi-chain portfolio summary (default view)
• Use \`/balances --insights\` for portfolio analysis and recommendations
• Use \`/balances --sort symbol\` or \`--min-usd 10\` for filtering

${priceNote}✅ **Live Data:** Real-time balances with ${chainIds.length === 1 ? '20s' : '30s'} cache`;

  return header + tokenRows + footer;
}

/**
 * Portfolio summary display formatter with aggregation and insights
 */
function formatPortfolioSummaryDisplay(
  summary: PortfolioSummary,
  filteredHoldings: AggregatedToken[],
  showInsights: boolean
): string {
  const now = new Date();

  // Build chain summary
  const chainSummary = summary.chainDistribution.length === 1
    ? `**Chain:** ${summary.chainDistribution[0].chainName} (${summary.chainDistribution[0].chainId})`
    : `**Chains:** ${summary.activeChains} chains (${summary.chainDistribution.slice(0, 2).map(c => c.chainName).join(', ')}${summary.activeChains > 2 ? ', ...' : ''})`;

  const header = `💰 Portfolio Summary

**Account:** ${summary.address.slice(0, 6)}...${summary.address.slice(-4)}
${chainSummary}
**Total Value:** ${formatUSDValue(summary.totalUsdValue, 'high')}
**Unique Tokens:** ${summary.uniqueTokens} types
**Total Positions:** ${summary.totalPositions} positions
**Updated:** ${now.toLocaleTimeString()}

`;

  if (filteredHoldings.length === 0) {
    return header + `🚫 No tokens found with sufficient balance

💡 **Tips:**
• Use --min-usd to adjust minimum value filter
• Try --chain to check other networks (e.g., --chain ethereum,polygon)
• Use --detailed for per-chain breakdown
• Ensure your wallet has tokens on the selected chain(s)`;
  }

  // Top Holdings Section
  const holdingsHeader = `🏆 TOP HOLDINGS\n`;
  const holdingRows = filteredHoldings.map((holding, index) => {
    const percentage = holding.portfolioPercentage.toFixed(1);

    // Format total balance with appropriate precision
    const balanceDisplay = parseFloat(holding.totalBalance).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    });

    // Build positions breakdown
    const positionBreakdown = holding.positions.length > 1
      ? holding.positions
          .sort((a, b) => b.usdValue - a.usdValue)
          .map(pos => {
            const posBalance = parseFloat(pos.balance).toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 8,
            });
            const posUsdValue = pos.usdValue > 0 ? ` (${formatUSDValue(pos.usdValue, 'low')})` : '';
            return `     • ${pos.chainName}: ${posBalance} ${holding.symbol}${posUsdValue}`;
          })
          .join('\n')
      : '';

    // Handle price availability
    const priceInfo = holding.priceUsd !== undefined
      ? `**${holding.symbol}** - ${formatUSDValue(holding.totalUsdValue, 'low')} (${percentage}%)`
      : `**${holding.symbol}** - (price unavailable)`;

    const mainRow = `${index + 1}. ${priceInfo}`;

    return positionBreakdown
      ? `${mainRow}\n${positionBreakdown}`
      : `${mainRow}\n     • Total: ${balanceDisplay} ${holding.symbol}`;
  }).join('\n\n');

  // Chain Distribution Section
  const chainHeader = `\n\n📊 CHAIN DISTRIBUTION\n`;
  const chainRows = summary.chainDistribution.map(chain => {
    const percentage = chain.percentage.toFixed(1);
    return `  • ${chain.chainName}: ${formatUSDValue(chain.usdValue, 'low')} (${percentage}%) - ${chain.tokenCount} token${chain.tokenCount !== 1 ? 's' : ''}`;
  }).join('\n');

  // Insights Section
  let insightsSection = '';
  if (showInsights && summary.insights.length > 0) {
    insightsSection = `\n⚠️ PORTFOLIO INSIGHTS\n`;
    insightsSection += summary.insights.map(insight => {
      const icon = insight.severity === 'warning' ? '⚠️' : insight.severity === 'critical' ? '🚨' : '💡';
      const actionText = insight.actionable ? `\n  → ${insight.actionable}` : '';
      return `${icon} ${insight.title}: ${insight.description}${actionText}`;
    }).join('\n');
  }

  // Quick Actions Section
  const quickActions = `\n\n💡 **QUICK ACTIONS:**\n`;
  const actionItems = [
    '• Use `/send <amount> <token> to <address>` to transfer tokens',
    '• Use `/balances --detailed` for per-token breakdown',
    '• Use `/balances --insights` for portfolio analysis and recommendations',
    '• Use `/balances --chain ethereum` to focus on specific chains',
    '• Use `/bals --sort symbol` or `/portfolio --min-usd 10` for filtering',
  ].join('\n');

  // Data freshness note
  const hasUnpricedTokens = filteredHoldings.some(token => token.priceUsd === undefined);
  const priceNote = hasUnpricedTokens
    ? `\n⚠️  Some tokens show "(price unavailable)" - total may be incomplete\n`
    : '';

  const footer = `\n${priceNote}✅ **Live Data:** Aggregated portfolio with 20s cache`;

  return header + holdingsHeader + holdingRows + chainHeader + chainRows + insightsSection + quickActions + actionItems + footer;
}
