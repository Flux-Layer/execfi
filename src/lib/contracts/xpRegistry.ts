import { http, createPublicClient } from "viem";
import { baseSepolia, base } from "viem/chains";
import { DEGENSHOOT_CHAIN_ID, XP_REGISTRY_ADDRESS } from "./addresses";

export const XP_REGISTRY_ABI = [
  {
    type: "function",
    name: "getNonce",
    inputs: [
      { name: "account", type: "address" },
      { name: "gameId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const XP_REGISTRY_CHAIN =
  DEGENSHOOT_CHAIN_ID === base.id ? base : baseSepolia;

const DEFAULT_RPC_URL =
  process.env.RPC_URL_BASE_SEPOLIA ??
  XP_REGISTRY_CHAIN.rpcUrls?.default?.http?.[0] ??
  "https://base-sepolia.g.alchemy.com/v2/RPaPFgRE5Jopa1P1mHlyf_Bil8k_dbyq";

export const xpRegistryPublicClient = createPublicClient({
  chain: XP_REGISTRY_CHAIN,
  transport: http(DEFAULT_RPC_URL),
});
