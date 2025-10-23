import { createWalletClient, custom, http, type Address, type Abi } from "viem";
import { createPublicClient } from "viem";
import { baseSepolia, base } from "viem/chains";
import WagerVaultArtifact from "../../../contracts/out/WagerVault.sol/WagerVault.json";
import {
  DEGENSHOOT_CHAIN_ID,
  WAGER_VAULT_ADDRESS,
  DEGENSHOOT_ADDRESS,
} from "./addresses";
import { getPrimaryRpcUrl } from '../rpc/endpoints';

export const WAGER_VAULT_ABI = WagerVaultArtifact.abi as Abi;

export const WAGER_VAULT_CHAIN =
  DEGENSHOOT_CHAIN_ID === base.id ? base : baseSepolia;

const WAGER_VAULT_CHAIN_ID = DEGENSHOOT_CHAIN_ID;

const DEFAULT_RPC_URL =
  process.env.RPC_URL_BASE_SEPOLIA ||
  getPrimaryRpcUrl(WAGER_VAULT_CHAIN_ID) ||
  WAGER_VAULT_CHAIN.rpcUrls?.default?.http?.[0] ||
  "https://sepolia.base.org";

export const wagerVaultPublicClient = createPublicClient({
  chain: WAGER_VAULT_CHAIN,
  transport: http(DEFAULT_RPC_URL, {
    timeout: 10000,
  }),
});

export function createWagerVaultWalletClient(provider: any, account: Address) {
  return createWalletClient({
    account,
    chain: WAGER_VAULT_CHAIN,
    transport: custom(provider),
  });
}

export const IS_ONCHAIN_READY =
  Boolean(WAGER_VAULT_ADDRESS && DEGENSHOOT_ADDRESS);
