import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { getAllWagmiChains, getSupportedChains } from "./src/lib/chains/registry";

// Get all supported chains from registry
const supportedChains = getAllWagmiChains();

// Create transports for all supported chains
const transports = getSupportedChains().reduce((acc, chain) => {
  acc[chain.id] = http(chain.rpcUrl);
  return acc;
}, {} as Record<number, ReturnType<typeof http>>);

export const wagmiConfig = createConfig({
  chains: supportedChains as any,
  transports,
});
