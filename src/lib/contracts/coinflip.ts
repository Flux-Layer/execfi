import {
  type Address,
  type Chain,
  createWalletClient,
  custom,
  createPublicClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import CoinFlipArtifact from "../../../contracts/out/CoinFlipGame.sol/CoinFlipGame.json";
import {
  COINFLIP_ADDRESS,
  COINFLIP_CHAIN_ID,
  COINFLIP_GAME_ID,
} from "./addresses";
import { getPrimaryRpcUrl } from '../rpc/endpoints';

export const COINFLIP_ABI = CoinFlipArtifact.abi;

export type CoinFlipAbi = typeof COINFLIP_ABI;

export const COINFLIP_CHAIN: Chain =
  COINFLIP_CHAIN_ID === base.id ? base : baseSepolia;

const DEFAULT_RPC_URL =
  process.env.RPC_URL_BASE_SEPOLIA ||
  getPrimaryRpcUrl(COINFLIP_CHAIN_ID) ||
  COINFLIP_CHAIN.rpcUrls?.default?.http?.[0] ||
  "https://sepolia.base.org";

export const COINFLIP_DOMAIN = {
  name: "CoinFlipGame",
  version: "1",
  chainId: COINFLIP_CHAIN_ID,
  verifyingContract: (COINFLIP_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as Address,
} as const;

export const COINFLIP_GAME_ID_BIGINT = BigInt(COINFLIP_GAME_ID);

export function createCoinFlipWalletClient(provider: unknown, account: Address) {
  if (!provider) {
    throw new Error("Ethereum provider is required to create CoinFlip wallet client");
  }

  return createWalletClient({
    account,
    chain: COINFLIP_CHAIN,
    transport: custom(provider as Parameters<typeof custom>[0]),
  });
}

export const coinFlipPublicClient = createPublicClient({
  chain: COINFLIP_CHAIN,
  transport: http(DEFAULT_RPC_URL, {
    timeout: 10000,
  }),
});

export function getCoinFlipSignerAccount() {
  const key = process.env.COINFLIP_SIGNER_PRIVATE_KEY ?? process.env.GAME_SIGNER_PRIVATE_KEY;
  if (!key) throw new Error("COINFLIP_SIGNER_PRIVATE_KEY not configured");
  return privateKeyToAccount(
    key.startsWith("0x") ? (key as `0x${string}`) : (`0x${key}` as `0x${string}`),
  );
}
