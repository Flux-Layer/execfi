// lib/ens.ts - ENS resolution utilities

import { normalize } from "viem/ens";
import { createPublicClient, http, type Address } from "viem";
import { mainnet } from "viem/chains";

/**
 * Create a public client for ENS resolution on Ethereum mainnet
 */
function getEnsClient() {
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
  const rpcUrl = alchemyKey
    ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
    : "https://rpc.ankr.com/eth";

  return createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl),
  });
}

/**
 * Check if a string is a valid ENS name
 */
export function isEnsName(name: string): boolean {
  return name.endsWith(".eth") || name.includes(".");
}

/**
 * Resolve an ENS name to an Ethereum address
 * @param ensName - The ENS name to resolve (e.g., "vitalik.eth")
 * @returns The resolved Ethereum address or null if not found
 */
export async function resolveEnsName(ensName: string): Promise<Address | null> {
  try {
    // Normalize the ENS name (handles special characters, etc.)
    const normalizedName = normalize(ensName);

    // Create public client for ENS resolution
    const client = getEnsClient();

    // Resolve ENS name to address
    const address = await client.getEnsAddress({
      name: normalizedName,
    });

    return address;
  } catch (error) {
    console.error("ENS resolution error:", error);
    return null;
  }
}

/**
 * Resolve an ENS name or return the address if already valid
 * @param addressOrEns - Either a 0x address or an ENS name
 * @returns The resolved Ethereum address
 * @throws {Error} If the ENS name cannot be resolved or address is invalid
 */
export async function resolveAddressOrEns(
  addressOrEns: string
): Promise<Address> {
  // If it's an ENS name, resolve it
  if (isEnsName(addressOrEns)) {
    const resolved = await resolveEnsName(addressOrEns);
    if (!resolved) {
      throw new Error(`Could not resolve ENS name: ${addressOrEns}`);
    }
    return resolved;
  }

  // Otherwise, return the address as-is
  return addressOrEns as Address;
}
