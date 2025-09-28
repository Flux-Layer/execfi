// lib/explorer.ts - Blockchain explorer URL helpers
import {
   getChainConfig,
   getExplorerTxUrl,
   getExplorerAddressUrl,
   getChainDisplayName,
} from "./chains/registry";

/**
 * Get explorer name for a chain
 */
export function getExplorerName(chainId: number): string {
   const config = getChainConfig(chainId);
   return config?.explorerName || "Unknown Explorer";
}

/**
 * Generate transaction URL for blockchain explorer
 */
export function getTxUrl(chainId: number, txHash: string): string {
   return getExplorerTxUrl(chainId, txHash);
}

/**
 * Generate address URL for blockchain explorer
 */
export function getAddressUrl(chainId: number, address: string): string {
   return getExplorerAddressUrl(chainId, address);
}

/**
 * Get chain name from chainId
 */
export function getChainName(chainId: number): string {
   return getChainDisplayName(chainId);
}

/**
 * Format success message with explorer link
 */
export function formatSuccessMessage(
   amount: string,
   chainId: number,
   txHash: string,
): string {
   const config = getChainConfig(chainId);
   const chainName = config?.name || `Chain ${chainId}`;
   const symbol = config?.nativeCurrency.symbol || "ETH";

   return `✅ Sent ${amount} ${symbol} on ${chainName} — hash ${txHash}`;
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
   console.log({ explorerName, url, text, chainId, txHash });

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
export function shortenTxHash(
   txHash: string,
   startChars = 6,
   endChars = 4,
): string {
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
export function shortenAddress(
   address: string,
   startChars = 6,
   endChars = 4,
): string {
   if (!address || address.length <= startChars + endChars + 2) {
      return address;
   }

   return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}
