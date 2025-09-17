// lib/explorer.ts - Blockchain explorer URL helpers

/**
 * Explorer configurations for supported chains
 */
const EXPLORER_CONFIG = {
  // Base Mainnet
  8453: {
    name: "BaseScan",
    baseUrl: "https://basescan.org",
    txPath: "/tx/",
    addressPath: "/address/",
  },
  // Base Sepolia
  84532: {
    name: "BaseScan Sepolia",
    baseUrl: "https://sepolia.basescan.org",
    txPath: "/tx/",
    addressPath: "/address/",
  },
  // Ethereum Mainnet (future)
  1: {
    name: "Etherscan",
    baseUrl: "https://etherscan.io",
    txPath: "/tx/",
    addressPath: "/address/",
  },
  // Polygon (future)
  137: {
    name: "PolygonScan",
    baseUrl: "https://polygonscan.com",
    txPath: "/tx/",
    addressPath: "/address/",
  },
  // Arbitrum (future)
  42161: {
    name: "Arbiscan",
    baseUrl: "https://arbiscan.io",
    txPath: "/tx/",
    addressPath: "/address/",
  },
  // Optimism (future)
  10: {
    name: "Optimistic Etherscan",
    baseUrl: "https://optimistic.etherscan.io",
    txPath: "/tx/",
    addressPath: "/address/",
  },
};

/**
 * Get explorer name for a chain
 */
export function getExplorerName(chainId: number): string {
  const config = EXPLORER_CONFIG[chainId as keyof typeof EXPLORER_CONFIG];
  return config?.name || "Unknown Explorer";
}

/**
 * Generate transaction URL for blockchain explorer
 */
export function getTxUrl(chainId: number, txHash: string): string {
  const config = EXPLORER_CONFIG[chainId as keyof typeof EXPLORER_CONFIG];

  if (!config) {
    console.warn(`No explorer config found for chainId ${chainId}`);
    return `#${txHash}`; // Fallback to hash anchor
  }

  return `${config.baseUrl}${config.txPath}${txHash}`;
}

/**
 * Generate address URL for blockchain explorer
 */
export function getAddressUrl(chainId: number, address: string): string {
  const config = EXPLORER_CONFIG[chainId as keyof typeof EXPLORER_CONFIG];

  if (!config) {
    console.warn(`No explorer config found for chainId ${chainId}`);
    return `#${address}`; // Fallback to hash anchor
  }

  return `${config.baseUrl}${config.addressPath}${address}`;
}

/**
 * Get chain name from chainId
 */
export function getChainName(chainId: number): string {
  const chainNames: Record<number, string> = {
    8453: "Base",
    84532: "Base Sepolia",
    1: "Ethereum",
    137: "Polygon",
    42161: "Arbitrum",
    10: "Optimism",
    43114: "Avalanche",
  };

  return chainNames[chainId] || `Chain ${chainId}`;
}

/**
 * Format success message with explorer link
 */
export function formatSuccessMessage(
  amount: string,
  chainId: number,
  txHash: string,
): string {
  const chainName = getChainName(chainId);

  return `✅ Sent ${amount} ETH on ${chainName} — hash ${txHash}`;
}

/**
 * Generate clickable explorer link for terminal display
 */
export function generateExplorerLink(
  chainId: number,
  txHash: string,
): { url: string; text: string; explorerName: string } {
  const explorerName = getExplorerName(chainId);
  const url = getTxUrl(chainId, txHash);
  const text = `View on ${explorerName}`;

  return { url, text, explorerName };
}

/**
 * Validate transaction hash format
 */
export function isValidTxHash(txHash: string): boolean {
  // Check if it's a valid hex string starting with 0x and 64 characters long
  const txHashRegex = /^0x[a-fA-F0-9]{64}$/;
  return txHashRegex.test(txHash);
}

/**
 * Shorten transaction hash for display
 */
export function shortenTxHash(txHash: string, startChars = 6, endChars = 4): string {
  if (!isValidTxHash(txHash)) {
    return txHash; // Return as-is if invalid format
  }

  if (txHash.length <= startChars + endChars + 2) {
    return txHash; // Too short to shorten
  }

  return `${txHash.slice(0, startChars + 2)}...${txHash.slice(-endChars)}`;
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string, startChars = 6, endChars = 4): string {
  if (!address || address.length <= startChars + endChars + 2) {
    return address;
  }

  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}