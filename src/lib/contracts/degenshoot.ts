import {
  type Address,
  type Chain,
  createWalletClient,
  custom,
  createPublicClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, base } from "viem/chains";
import DegenshootArtifact from "../../../contracts/out/Degenshoot.sol/Degenshoot.json";
import {
  DEGENSHOOT_ADDRESS,
  DEGENSHOOT_CHAIN_ID,
  DEGENSHOOT_GAME_ID,
} from "./addresses";
import { getPrimaryRpcUrl } from '../rpc/endpoints';

export const DEGENSHOOT_ABI = DegenshootArtifact.abi;

export type DegenshootAbi = typeof DEGENSHOOT_ABI;

export const DEGENSHOOT_CHAIN: Chain =
  DEGENSHOOT_CHAIN_ID === base.id ? base : baseSepolia;

const DEFAULT_RPC_URL =
  process.env.RPC_URL_BASE_SEPOLIA ||
  getPrimaryRpcUrl(DEGENSHOOT_CHAIN_ID) ||
  DEGENSHOOT_CHAIN.rpcUrls?.default?.http?.[0] ||
  "https://sepolia.base.org";

export const DEGENSHOOT_DOMAIN = {
  name: "Degenshoot",
  version: "1",
  chainId: DEGENSHOOT_CHAIN_ID,
  verifyingContract: (DEGENSHOOT_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as Address,
} as const;

export const DEGENSHOOT_GAME_ID_BIGINT = BigInt(DEGENSHOOT_GAME_ID);

export function createDegenshootWalletClient(provider: unknown, account: Address) {
  if (!provider) {
    throw new Error("Ethereum provider is required to create Degenshoot wallet client");
  }

  return createWalletClient({
    account,
    chain: DEGENSHOOT_CHAIN,
    transport: custom(provider as Parameters<typeof custom>[0]),
  });
}

export const degenshootPublicClient = createPublicClient({
  chain: DEGENSHOOT_CHAIN,
  transport: http(DEFAULT_RPC_URL, {
    timeout: 10000, // 10 second timeout
  }),
});

export function getGameSignerAccount() {
  const key = process.env.GAME_SIGNER_PRIVATE_KEY;
  if (!key) throw new Error("GAME_SIGNER_PRIVATE_KEY not configured");
  return privateKeyToAccount(
    key.startsWith("0x") ? (key as `0x${string}`) : (`0x${key}` as `0x${string}`),
  );
}
