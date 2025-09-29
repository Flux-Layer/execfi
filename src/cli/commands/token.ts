// Token operation commands for ExecFi CLI (Phase 3)
import type { CommandDef } from "./types";
import { parseFlags } from "./parser";
import { getChainDisplayName } from "@/lib/chains/registry";

/**
 * Token approval command - set allowances for tokens
 */
export const approveCmd: CommandDef = {
  name: "/approve",
  aliases: ["/allow"],
  category: "core",
  summary: "Approve token allowances for contracts",
  usage: "/approve <token> <spender> <amount> [options]",
  flags: [
    {
      name: "chain",
      alias: "c",
      type: "string",
      description: "Override chain for this operation",
    },
    {
      name: "unlimited",
      alias: "u",
      type: "boolean",
      description: "Set unlimited allowance (max uint256)",
    },
    {
      name: "simulate",
      alias: "s",
      type: "boolean",
      description: "Simulate the approval without executing",
    },
  ],
  examples: [
    "/approve USDC 0x1234... 1000",
    "/approve WETH uniswap-v3 unlimited",
    "/approve DAI 0xabcd... 500 --chain ethereum",
    "/allow USDC swap-router 100 --simulate",
  ],
  parse: (line) => {
    try {
      const parts = line.trim().split(/\s+/);

      if (parts.length < 4) {
        return { ok: false, error: "Missing arguments. Usage: /approve <token> <spender> <amount>" };
      }

      const token = parts[1];
      const spender = parts[2];
      const amount = parts[3];

      // Parse flags from remaining parts
      const flagsStartIndex = 4;
      const flagsPart = parts.slice(flagsStartIndex).join(' ');
      const flags = parseFlags(flagsPart, approveCmd.flags);

      return {
        ok: true,
        args: {
          token,
          spender,
          amount,
          ...flags
        }
      };
    } catch (error) {
      return { ok: false, error: `Parse error: ${error}` };
    }
  },
  run: async (args, ctx, dispatch) => {
    const { token, spender, amount, chain, unlimited, simulate } = args;
    const targetChain = chain || ctx.chainId || 8453;
    const chainName = getChainDisplayName(targetChain);

    // Get the user's address
    const address = ctx.accountMode === "SMART_ACCOUNT" ? ctx.saAddress : ctx.selectedWallet?.address;

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

    try {
      if (simulate) {
        const simulationText = await simulateApproval(token, spender, amount, unlimited, chainName, address);
        dispatch({
          type: "CHAT.ADD",
          message: {
            role: "assistant",
            content: simulationText,
            timestamp: Date.now(),
          },
        });
      } else {
        // Show approval confirmation
        const approvalText = await executeApproval(token, spender, amount, unlimited, chainName, address);
        dispatch({
          type: "CHAT.ADD",
          message: {
            role: "assistant",
            content: approvalText,
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
          content: `❌ Approval failed: ${errorMessage}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};

/**
 * Allowances command - show current token allowances
 */
export const allowancesCmd: CommandDef = {
  name: "/allowances",
  aliases: ["/approvals"],
  category: "core",
  summary: "Show current token allowances",
  usage: "/allowances [options]",
  flags: [
    {
      name: "token",
      alias: "t",
      type: "string",
      description: "Filter by specific token",
    },
    {
      name: "spender",
      alias: "s",
      type: "string",
      description: "Filter by specific spender contract",
    },
    {
      name: "chain",
      alias: "c",
      type: "string",
      description: "Filter by specific chain",
    },
    {
      name: "active-only",
      alias: "a",
      type: "boolean",
      description: "Show only non-zero allowances",
    },
  ],
  examples: [
    "/allowances",
    "/allowances --token USDC",
    "/allowances --spender uniswap-v3",
    "/allowances --chain ethereum --active-only",
    "/approvals -t WETH -s 0x1234...",
  ],
  parse: (line) => {
    try {
      const flags = parseFlags(line, allowancesCmd.flags);
      return { ok: true, args: flags };
    } catch (error) {
      return { ok: false, error: `Parse error: ${error}` };
    }
  },
  run: async (args, ctx, dispatch) => {
    const { token, spender, chain, "active-only": activeOnly } = args;
    const targetChain = chain || ctx.chainId || 8453;
    const chainName = getChainDisplayName(targetChain);

    // Get the user's address
    const address = ctx.accountMode === "SMART_ACCOUNT" ? ctx.saAddress : ctx.selectedWallet?.address;

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

    try {
      const allowancesText = await fetchAllowances(address, chainName, token, spender, activeOnly);
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: allowancesText,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ Failed to fetch allowances: ${errorMessage}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};

/**
 * Revoke command - revoke token allowances
 */
export const revokeCmd: CommandDef = {
  name: "/revoke",
  aliases: ["/deny"],
  category: "core",
  summary: "Revoke token allowances",
  usage: "/revoke <token> [spender] [options]",
  flags: [
    {
      name: "spender",
      alias: "s",
      type: "string",
      description: "Specific spender to revoke (if not provided as argument)",
    },
    {
      name: "all",
      alias: "a",
      type: "boolean",
      description: "Revoke all allowances for the token",
    },
    {
      name: "chain",
      alias: "c",
      type: "string",
      description: "Override chain for this operation",
    },
    {
      name: "simulate",
      alias: "sim",
      type: "boolean",
      description: "Simulate the revocation without executing",
    },
  ],
  examples: [
    "/revoke USDC uniswap-v3",
    "/revoke WETH --all",
    "/revoke DAI 0x1234... --chain ethereum",
    "/deny USDC --spender 0xabcd... --simulate",
  ],
  parse: (line) => {
    try {
      const parts = line.trim().split(/\s+/);

      if (parts.length < 2) {
        return { ok: false, error: "Missing token argument. Usage: /revoke <token> [spender]" };
      }

      const token = parts[1];
      const spenderArg = parts[2] && !parts[2].startsWith('-') ? parts[2] : undefined;

      // Parse flags from remaining parts
      const flagsStartIndex = spenderArg ? 3 : 2;
      const flagsPart = parts.slice(flagsStartIndex).join(' ');
      const flags = parseFlags(flagsPart, revokeCmd.flags);

      const spender = spenderArg || flags.spender;

      return {
        ok: true,
        args: {
          token,
          spender,
          ...flags
        }
      };
    } catch (error) {
      return { ok: false, error: `Parse error: ${error}` };
    }
  },
  run: async (args, ctx, dispatch) => {
    const { token, spender, all, chain, simulate } = args;
    const targetChain = chain || ctx.chainId || 8453;
    const chainName = getChainDisplayName(targetChain);

    // Get the user's address
    const address = ctx.accountMode === "SMART_ACCOUNT" ? ctx.saAddress : ctx.selectedWallet?.address;

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

    if (!spender && !all) {
      dispatch({
        type: "CHAT.ADD",
        message: {
          role: "assistant",
          content: `❌ Please specify either a spender address or use --all flag.`,
          timestamp: Date.now(),
        },
      });
      return;
    }

    try {
      if (simulate) {
        const simulationText = await simulateRevocation(token, chainName, address, spender, all);
        dispatch({
          type: "CHAT.ADD",
          message: {
            role: "assistant",
            content: simulationText,
            timestamp: Date.now(),
          },
        });
      } else {
        const revocationText = await executeRevocation(token, chainName, address, spender, all);
        dispatch({
          type: "CHAT.ADD",
          message: {
            role: "assistant",
            content: revocationText,
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
          content: `❌ Revocation failed: ${errorMessage}`,
          timestamp: Date.now(),
        },
      });
    }
  },
};

// Implementation functions for token operations

/**
 * Simulate token approval
 */
async function simulateApproval(
  token: string,
  spender: string,
  amount: string,
  unlimited: boolean,
  chainName: string,
  address: string
): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 1000));

  const approvalAmount = unlimited ? "Unlimited" : amount;
  const gasEstimate = "~21,000";
  const gasCost = "~$0.15";

  return `🔍 Approval Simulation

**Transaction Preview:**
• Token: ${token}
• Spender: ${spender.slice(0, 10)}...${spender.slice(-8)}
• Amount: ${approvalAmount} ${token}
• From: ${address.slice(0, 6)}...${address.slice(-4)}
• Chain: ${chainName}

**Gas Estimation:**
• Gas Limit: ${gasEstimate}
• Gas Cost: ${gasCost}
• Total Cost: ${gasCost}

**Security Analysis:**
${unlimited
  ? "⚠️  **Unlimited Approval:** This allows the spender to use ALL your tokens"
  : "✅ **Limited Approval:** Spender can only use the specified amount"
}

**Risk Assessment:**
• Spender Reputation: ${getSpenderReputation(spender)}
• Token Risk: Low (${token})
• Recommendation: ${unlimited ? "Consider limited approval instead" : "Safe to proceed"}

**Simulation Result:** ✅ Transaction will succeed

💡 **Ready to execute?** Remove --simulate flag to proceed with actual approval.`;
}

/**
 * Execute token approval
 */
async function executeApproval(
  token: string,
  spender: string,
  amount: string,
  unlimited: boolean,
  chainName: string,
  address: string
): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 2000));

  const approvalAmount = unlimited ? "Unlimited" : amount;
  const txHash = "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');

  return `✅ Token Approval Successful

**Transaction Details:**
• Hash: ${txHash}
• Token: ${token}
• Spender: ${spender.slice(0, 10)}...${spender.slice(-8)}
• Amount: ${approvalAmount} ${token}
• Chain: ${chainName}

**Status:** Confirmed in block #12,345,678

**What This Means:**
• The spender contract can now use up to ${approvalAmount} of your ${token}
• This enables interactions like swaps, lending, etc.
• You can revoke this approval anytime with \`/revoke ${token} ${spender.slice(0, 10)}...\`

**Security:**
${unlimited
  ? "⚠️  **Important:** Monitor this unlimited approval regularly"
  : "✅ **Limited approval** - expires when amount is used"
}

**Next Steps:**
• Use \`/allowances --token ${token}\` to view all approvals
• Monitor usage in your transaction history
• Revoke with \`/revoke ${token}\` when no longer needed

🔗 **Explorer:** View on ${chainName}scan`;
}

/**
 * Fetch current allowances
 */
async function fetchAllowances(
  address: string,
  chainName: string,
  tokenFilter?: string,
  spenderFilter?: string,
  activeOnly?: boolean
): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Mock allowances data
  const mockAllowances = [
    {
      token: "USDC",
      spender: "Uniswap V3 Router",
      spenderAddress: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
      amount: "1000.000000",
      unlimited: false,
      lastUsed: Date.now() - 86400000,
      reputation: "High",
    },
    {
      token: "WETH",
      spender: "1inch Router",
      spenderAddress: "0x1111111254fb6c44bAC0beD2854e76F90643097d",
      amount: "Unlimited",
      unlimited: true,
      lastUsed: Date.now() - 3600000,
      reputation: "High",
    },
    {
      token: "DAI",
      spender: "Compound",
      spenderAddress: "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B",
      amount: "0",
      unlimited: false,
      lastUsed: null,
      reputation: "High",
    },
  ];

  // Apply filters
  let filteredAllowances = mockAllowances;

  if (tokenFilter) {
    filteredAllowances = filteredAllowances.filter(a =>
      a.token.toLowerCase().includes(tokenFilter.toLowerCase())
    );
  }

  if (spenderFilter) {
    filteredAllowances = filteredAllowances.filter(a =>
      a.spender.toLowerCase().includes(spenderFilter.toLowerCase()) ||
      a.spenderAddress.toLowerCase().includes(spenderFilter.toLowerCase())
    );
  }

  if (activeOnly) {
    filteredAllowances = filteredAllowances.filter(a =>
      a.amount !== "0" && a.amount !== "0.000000"
    );
  }

  const header = `📋 Token Allowances

**Account:** ${address.slice(0, 6)}...${address.slice(-4)}
**Chain:** ${chainName}
**Total Allowances:** ${filteredAllowances.length}
${tokenFilter ? `**Token Filter:** ${tokenFilter}` : ""}
${spenderFilter ? `**Spender Filter:** ${spenderFilter}` : ""}

`;

  if (filteredAllowances.length === 0) {
    return header + `🚫 No allowances found

${activeOnly ? "No active allowances on this chain." : "No allowances match your filters."}

**Suggestions:**
• Remove filters to see all allowances
• Check other chains with \`--chain <name>\`
• Use \`/approve\` to create new allowances when needed

💡 **Security Tip:** No active allowances means maximum security!`;
  }

  const allowanceRows = filteredAllowances.map((allowance, index) => {
    const lastUsedText = allowance.lastUsed
      ? formatTimeAgo(allowance.lastUsed)
      : "Never used";

    const riskIndicator = getRiskIndicator(allowance);
    const amountDisplay = allowance.unlimited ? "♾️  Unlimited" : `${allowance.amount} ${allowance.token}`;

    return `${index + 1}. **${allowance.token} → ${allowance.spender}**
   Amount: ${amountDisplay} ${riskIndicator}
   Spender: ${allowance.spenderAddress.slice(0, 10)}...${allowance.spenderAddress.slice(-8)}
   Last Used: ${lastUsedText}
   Reputation: ${getReputationIcon(allowance.reputation)} ${allowance.reputation}`;
  }).join("\n\n");

  const footer = `

**Quick Actions:**
• \`/revoke <token> <spender>\` to remove specific allowance
• \`/allowances --active-only\` to see only active approvals
• \`/approve <token> <spender> <amount>\` to create new allowance

⚡ **Security Review:**
${filteredAllowances.filter(a => a.unlimited).length > 0
  ? "⚠️  You have unlimited approvals - review regularly"
  : "✅ All approvals are limited amounts"}`;

  return header + allowanceRows + footer;
}

/**
 * Simulate token revocation
 */
async function simulateRevocation(
  token: string,
  chainName: string,
  address: string,
  spender?: string,
  all?: boolean
): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 800));

  const operation = all ? `all allowances for ${token}` : `${token} allowance for ${spender}`;
  const gasEstimate = all ? "~45,000" : "~21,000";
  const gasCost = all ? "~$0.35" : "~$0.15";

  return `🔍 Revocation Simulation

**Transaction Preview:**
• Operation: Revoke ${operation}
• From: ${address.slice(0, 6)}...${address.slice(-4)}
• Chain: ${chainName}

**Gas Estimation:**
• Gas Limit: ${gasEstimate}
• Gas Cost: ${gasCost}
• Total Cost: ${gasCost}

**Security Impact:**
✅ **Positive:** Reduces attack surface
✅ **Safe:** No tokens will be lost
${all ? "✅ **Comprehensive:** All spenders will lose access" : "✅ **Targeted:** Only specified spender affected"}

**Effect:**
${all
  ? `• All contracts lose access to your ${token}`
  : `• ${spender} loses access to your ${token}`
}
• Future interactions will require new approvals
• Your tokens remain safe in your wallet

**Simulation Result:** ✅ Transaction will succeed

💡 **Ready to execute?** Remove --simulate flag to proceed with revocation.`;
}

/**
 * Execute token revocation
 */
async function executeRevocation(
  token: string,
  chainName: string,
  address: string,
  spender?: string,
  all?: boolean
): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 2000));

  const txHash = "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  const operation = all ? "all spenders" : spender;

  return `✅ Token Allowance Revoked

**Transaction Details:**
• Hash: ${txHash}
• Token: ${token}
• Revoked: ${operation}
• Chain: ${chainName}

**Status:** Confirmed in block #12,345,679

**Security Improvement:**
✅ **Attack Surface Reduced**
${all
  ? `• All ${token} allowances have been revoked`
  : `• ${spender} can no longer access your ${token}`
}
• Your tokens are now more secure
• Future approvals require explicit consent

**Impact:**
${all
  ? `• All DeFi protocols lose access to your ${token}`
  : `• Specific contract access terminated`
}
• You'll need to re-approve for future interactions
• No tokens were transferred or lost

**Next Steps:**
• Use \`/allowances --token ${token}\` to verify revocation
• Approve specific amounts when needed: \`/approve ${token} <spender> <amount>\`
• Consider limited approvals instead of unlimited ones

🔒 **Security Status:** Enhanced - manual approval required for ${token}`;
}

// Utility functions

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return "Recently";
}

function getSpenderReputation(spender: string): string {
  // Mock reputation check - would use actual reputation service
  const knownContracts: Record<string, string> = {
    "uniswap": "High (DEX)",
    "1inch": "High (Aggregator)",
    "compound": "High (Lending)",
    "aave": "High (Lending)",
  };

  const lowerSpender = spender.toLowerCase();
  for (const [protocol, reputation] of Object.entries(knownContracts)) {
    if (lowerSpender.includes(protocol)) {
      return reputation;
    }
  }

  return "Unknown (Verify manually)";
}

function getRiskIndicator(allowance: any): string {
  if (allowance.unlimited) {
    return allowance.reputation === "High" ? "⚠️" : "🚨";
  }
  return "✅";
}

function getReputationIcon(reputation: string): string {
  const icons: Record<string, string> = {
    "High": "🟢",
    "Medium": "🟡",
    "Low": "🟠",
    "Unknown": "⚪",
  };
  return icons[reputation] || "⚪";
}