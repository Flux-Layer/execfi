import { http, createPublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, base } from "viem/chains";
import {
  DEGENSHOOT_CHAIN_ID,
  XP_REGISTRY_ADDRESS,
} from "./addresses";
import { getPrimaryRpcUrl } from '../rpc/endpoints';

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
  {
    type: "function",
    name: "xp",
    inputs: [
      { name: "account", type: "address" },
      { name: "gameId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalXP",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const XP_REGISTRY_CHAIN =
  DEGENSHOOT_CHAIN_ID === base.id ? base : baseSepolia;

const XP_REGISTRY_CHAIN_ID = DEGENSHOOT_CHAIN_ID;

const DEFAULT_RPC_URL =
  process.env.RPC_URL_BASE_SEPOLIA ||
  getPrimaryRpcUrl(XP_REGISTRY_CHAIN_ID) ||
  XP_REGISTRY_CHAIN.rpcUrls?.default?.http?.[0] ||
  "https://sepolia.base.org";

export const xpRegistryPublicClient = createPublicClient({
  chain: XP_REGISTRY_CHAIN,
  transport: http(DEFAULT_RPC_URL, {
    timeout: 10000,
  }),
});

export const XP_DOMAIN = {
  name: "XPRegistry",
  version: "1",
  chainId: DEGENSHOOT_CHAIN_ID,
  verifyingContract: (XP_REGISTRY_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
} as const;

export function getXpSignerAccount() {
  const key =
    process.env.XP_SIGNER_PRIVATE_KEY ?? process.env.GAME_SIGNER_PRIVATE_KEY;
  if (!key) throw new Error("XP_SIGNER_PRIVATE_KEY not configured");
  return privateKeyToAccount(
    key.startsWith("0x") ? (key as `0x${string}`) : (`0x${key}` as `0x${string}`),
  );
}
