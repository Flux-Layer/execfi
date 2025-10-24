import { useState } from "react";
import type { ConnectedWallet } from "@privy-io/react-auth";
import { createWalletClient, createPublicClient, custom, http, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { XP_REGISTRY_ADDRESS } from "@/lib/sunday-quest/constants";
import { debugLog } from "@/lib/utils/debugLog";

// Extended ABI with addXPWithSig function
const XP_REGISTRY_ABI = [
  {
    type: "function",
    name: "addXPWithSig",
    inputs: [
      { name: "user", type: "address" },
      { name: "gameId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
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

interface ClaimPayload {
  user: `0x${string}`;
  gameId: string;
  amount: string;
  nonce: string;
  deadline: string;
}

// Base Sepolia chain ID
const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_SEPOLIA_HEX = `0x${BASE_SEPOLIA_CHAIN_ID.toString(16)}` as `0x${string}`;

// Create public client for reading/waiting
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
});

export function useClaimQuestXP() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const claimXP = async (
    payload: ClaimPayload, 
    signature: `0x${string}`,
    wallet: ConnectedWallet,
    activeAddress: Address
  ) => {
    setIsPending(true);
    setError(null);

    try {
      // Extract current chain ID from wallet (format: "eip155:84532")
      let walletChainId: number | null = null;
      if (wallet.chainId) {
        const parts = wallet.chainId.split(":");
        const chainIdStr = parts[parts.length - 1];
        const parsed = Number(chainIdStr);
        walletChainId = Number.isFinite(parsed) ? parsed : null;
      }

      // Switch to Base Sepolia if needed (same as degenshoot)
      if (walletChainId && walletChainId !== BASE_SEPOLIA_CHAIN_ID) {
        debugLog(`Switching from chain ${walletChainId} to Base Sepolia (${BASE_SEPOLIA_CHAIN_ID})`);
        await wallet.switchChain(BASE_SEPOLIA_HEX);
      }

      // Get Ethereum provider from Privy wallet (same as degenshoot)
      const provider = await wallet.getEthereumProvider();
      
      // Create wallet client with viem (bypasses Wagmi)
      const walletClient = createWalletClient({
        account: activeAddress,
        chain: baseSepolia,
        transport: custom(provider),
      });

      // Write contract directly with viem
      const txHash = await walletClient.writeContract({
        address: XP_REGISTRY_ADDRESS as Address,
        abi: XP_REGISTRY_ABI,
        functionName: "addXPWithSig",
        args: [
          payload.user,
          BigInt(payload.gameId),
          BigInt(payload.amount),
          BigInt(payload.deadline),
          signature,
        ],
        account: activeAddress,
      });

      debugLog("Transaction submitted:", txHash);

      // Wait for transaction confirmation
      const receiptData = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });
      
      debugLog("Transaction confirmed:", receiptData);
      
      setIsPending(false);
      return { hash: txHash, receipt: receiptData };
      
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      setIsPending(false);
      throw errorObj;
    }
  };

  return {
    claimXP,
    isPending,
    isError: !!error,
    error,
  };
}
