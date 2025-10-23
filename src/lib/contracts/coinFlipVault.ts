import { createWalletClient, custom, http, type Address, type Abi } from "viem";
import { createPublicClient } from "viem";
import { base, baseSepolia } from "viem/chains";
import CoinFlipVaultArtifact from "../../../contracts/out/CoinFlipVault.sol/CoinFlipVault.json";
import {
  COINFLIP_CHAIN_ID,
  COINFLIP_VAULT_ADDRESS,
  COINFLIP_ADDRESS,
} from "./addresses";

export const COINFLIP_VAULT_ABI = CoinFlipVaultArtifact.abi as Abi;

export const COINFLIP_VAULT_CHAIN =
  COINFLIP_CHAIN_ID === base.id ? base : baseSepolia;

const DEFAULT_RPC_URL =
  process.env.RPC_URL_BASE_SEPOLIA ??
  COINFLIP_VAULT_CHAIN.rpcUrls?.default?.http?.[0] ??
  "https://base-sepolia.g.alchemy.com/v2/demo";

export const coinFlipVaultPublicClient = createPublicClient({
  chain: COINFLIP_VAULT_CHAIN,
  transport: http(DEFAULT_RPC_URL),
});

export function createCoinFlipVaultWalletClient(provider: unknown, account: Address) {
  if (!provider) {
    throw new Error("Ethereum provider is required to create CoinFlip vault wallet client");
  }

  return createWalletClient({
    account,
    chain: COINFLIP_VAULT_CHAIN,
    transport: custom(provider as Parameters<typeof custom>[0]),
  });
}

export const COINFLIP_ONCHAIN_READY =
  Boolean(COINFLIP_VAULT_ADDRESS && COINFLIP_ADDRESS);
