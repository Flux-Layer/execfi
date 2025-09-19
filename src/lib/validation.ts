// lib/validation.ts - Intent validation and policy enforcement

import { createPublicClient, http, formatEther } from "viem";
import { base, baseSepolia } from "viem/chains";
import type { NormalizedNativeTransfer, NormalizedIntent } from "./normalize";

export class ValidationError extends Error {
   constructor(message: string, public code: string) {
      super(message);
      this.name = "ValidationError";
   }
}

/**
 * Chain configuration for RPC calls
 */
const CHAIN_CONFIG = {
   8453: {
      chain: base,
      rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
   },
   84532: {
      chain: baseSepolia,
      rpcUrl: `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
   },
};

/**
 * Policy configuration (from env or defaults)
 */
const POLICY = {
   // Per-transaction limits in ETH
   MAX_TX_AMOUNT_ETH: parseFloat(process.env.MAX_TX_AMOUNT_ETH || "1.0"),

   // Daily spend limits in ETH
   DAILY_SPEND_LIMIT_ETH: parseFloat(process.env.DAILY_SPEND_LIMIT_ETH || "5.0"),

   // Gas headroom multiplier (110% = 1.1)
   GAS_HEADROOM_MULT: parseFloat(process.env.GAS_HEADROOM_MULT || "1.1"),

   // Minimum balance to keep after transaction (in ETH)
   MIN_BALANCE_AFTER_TX_ETH: parseFloat(
      process.env.MIN_BALANCE_AFTER_TX_ETH || "0.0000001"
   ),
};

/**
 * Create public client for chain operations
 */
function getPublicClient(chainId: number) {
   const config = CHAIN_CONFIG[chainId as keyof typeof CHAIN_CONFIG];
   if (!config) {
      throw new ValidationError(
         `Unsupported chainId: ${chainId}`,
         "CHAIN_UNSUPPORTED"
      );
   }

   return createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
   });
}

/**
 * Validate recipient address is not zero address
 */
function validateRecipient(to: `0x${string}`) {
   if (to === "0x0000000000000000000000000000000000000000") {
      throw new ValidationError("Cannot send to zero address", "ZERO_ADDRESS");
   }
}

/**
 * Validate amount is within policy limits
 */
function validateAmountLimits(amountWei: bigint) {
   const amountEth = parseFloat(formatEther(amountWei));

   if (amountEth > POLICY.MAX_TX_AMOUNT_ETH) {
      throw new ValidationError(
         `Amount ${amountEth} ETH exceeds maximum transaction limit of ${POLICY.MAX_TX_AMOUNT_ETH} ETH`,
         "AMOUNT_EXCEEDS_LIMIT"
      );
   }

   if (amountEth <= 0) {
      throw new ValidationError(
         "Amount must be greater than 0",
         "AMOUNT_TOO_SMALL"
      );
   }
}

/**
 * Estimate gas for native transfer
 */
async function estimateTransferGas(
   norm: NormalizedNativeTransfer,
   fromAddress: `0x${string}`
): Promise<bigint> {
   const publicClient = getPublicClient(norm.chainId);

   try {
      const gasEstimate = await publicClient.estimateGas({
         account: fromAddress,
         to: norm.to,
         value: norm.amountWei,
      });

      // Add gas headroom
      const gasWithHeadroom = BigInt(
         Math.ceil(Number(gasEstimate) * POLICY.GAS_HEADROOM_MULT)
      );
      return gasWithHeadroom;
   } catch {
      throw new ValidationError(
         "Failed to estimate gas for transaction",
         "GAS_ESTIMATION_FAILED"
      );
   }
}

/**
 * Get current gas price
 */
async function getCurrentGasPrice(chainId: number): Promise<bigint> {
   const publicClient = getPublicClient(chainId);

   try {
      return await publicClient.getGasPrice();
   } catch {
      throw new ValidationError(
         "Failed to get current gas price",
         "GAS_PRICE_FAILED"
      );
   }
}

/**
 * Check basic balance before gas estimation
 */
async function checkBasicBalance(
   norm: NormalizedNativeTransfer,
   fromAddress: `0x${string}`
): Promise<bigint> {
   const publicClient = getPublicClient(norm.chainId);
   const balance = await publicClient.getBalance({ address: fromAddress });

   // First check if we have enough balance for just the transfer amount
   console.log({balance, amountWei: norm.amountWei})
   if (balance < norm.amountWei) {
      const balanceEth = formatEther(balance);
      const amountEth = formatEther(norm.amountWei);

      throw new ValidationError(
         `Insufficient balance. You have ${balanceEth} ETH but trying to send ${amountEth} ETH`,
         "INSUFFICIENT_FUNDS"
      );
   }

   return balance;
}

/**
 * Validate user has sufficient balance for transfer + gas
 */
async function validateBalance(
   norm: NormalizedNativeTransfer,
   fromAddress: `0x${string}`,
   balance: bigint
): Promise<{ gasEstimate: bigint; gasCost: bigint }> {
   // Estimate gas and get gas price (now that we know basic balance is sufficient)
   const gasEstimate = await estimateTransferGas(norm, fromAddress);
   const gasPrice = await getCurrentGasPrice(norm.chainId);
   const gasCost = gasEstimate * gasPrice;

   // Calculate total cost (amount + gas)
   const totalCost = norm.amountWei + gasCost;

   // Check if balance is sufficient for total cost
   console.log({balance, totalCost})
   if (balance < totalCost) {
      const balanceEth = formatEther(balance);
      const totalCostEth = formatEther(totalCost);
      const gasCostEth = formatEther(gasCost);
      const amountEth = formatEther(norm.amountWei);

      throw new ValidationError(
         `Insufficient balance for transaction + gas. You have ${balanceEth} ETH but need ${totalCostEth} ETH (${amountEth} ETH + ${gasCostEth} ETH gas)`,
         "INSUFFICIENT_FUNDS_WITH_GAS"
      );
   }

   // Check minimum balance after transaction
   const balanceAfterTx = balance - totalCost;
   const minBalanceWei = BigInt(
      Math.floor(POLICY.MIN_BALANCE_AFTER_TX_ETH * 1e18)
   );

   if (balanceAfterTx < minBalanceWei) {
      const balanceAfterEth = formatEther(balanceAfterTx);
      throw new ValidationError(
         `Transaction would leave balance too low (${balanceAfterEth} ETH). Minimum ${POLICY.MIN_BALANCE_AFTER_TX_ETH} ETH required`,
         "BALANCE_TOO_LOW_AFTER_TX"
      );
   }

   return { gasEstimate, gasCost };
}

/**
 * Validate daily spend limits (placeholder - requires persistent storage)
 */
async function validateDailySpendLimit(
   norm: NormalizedNativeTransfer
): Promise<void> {
   // TODO: Implement daily spend tracking with persistent storage
   // For MVP, we'll skip this validation
   // In production, this would check against a database of user transactions

   const amountEth = parseFloat(formatEther(norm.amountWei));
   if (amountEth > POLICY.DAILY_SPEND_LIMIT_ETH) {
      throw new ValidationError(
         `Transaction amount ${amountEth} ETH exceeds daily limit of ${POLICY.DAILY_SPEND_LIMIT_ETH} ETH`,
         "DAILY_LIMIT_EXCEEDED"
      );
   }
}

/**
 * Main validation function
 * Returns gas estimates needed for execution
 */
export async function validateNativeTransfer(
   norm: NormalizedNativeTransfer,
   fromAddress: `0x${string}`
): Promise<{ gasEstimate: bigint; gasCost: bigint }> {
   // Basic validation
   validateRecipient(norm.to);
   validateAmountLimits(norm.amountWei);

   // Check basic balance first (before gas estimation)
   const balance = await checkBasicBalance(norm, fromAddress);

   // Balance and gas validation (with known balance)
   const { gasEstimate, gasCost } = await validateBalance(norm, fromAddress, balance);

   // Policy validation
   await validateDailySpendLimit(norm);

   return { gasEstimate, gasCost };
}

/**
 * Simulate transaction before execution
 */
export async function simulateTransfer(
   norm: NormalizedNativeTransfer,
   fromAddress: `0x${string}`
): Promise<void> {
   const publicClient = getPublicClient(norm.chainId);

   try {
      await publicClient.call({
         account: fromAddress,
         to: norm.to,
         value: norm.amountWei,
      });
   } catch {
      throw new ValidationError(
         "Transaction simulation failed. Transaction would likely fail on-chain",
         "SIMULATION_FAILED"
      );
   }
}

/**
 * Validation router for different intent types
 */
export async function validateIntent(
  norm: NormalizedIntent,
  fromAddress: `0x${string}`
): Promise<{ gasEstimate: bigint; gasCost: bigint }> {
  if (norm.kind === "native-transfer") {
    return validateNativeTransfer(norm, fromAddress);
  } else if (norm.kind === "erc20-transfer") {
    // For MVP, ERC-20 validation is not implemented yet
    throw new ValidationError(
      "ERC-20 token transfers not yet supported in MVP",
      "ERC20_NOT_IMPLEMENTED"
    );
  } else {
    throw new ValidationError(
      `Unknown transfer type: ${(norm as any).kind}`,
      "UNKNOWN_TRANSFER_TYPE"
    );
  }
}

/**
 * Simulation router for different intent types
 */
export async function simulateIntent(
  norm: NormalizedIntent,
  fromAddress: `0x${string}`
): Promise<void> {
  if (norm.kind === "native-transfer") {
    return simulateTransfer(norm, fromAddress);
  } else if (norm.kind === "erc20-transfer") {
    // For MVP, ERC-20 simulation is not implemented yet
    throw new ValidationError(
      "ERC-20 token simulation not yet supported in MVP",
      "ERC20_SIMULATION_NOT_IMPLEMENTED"
    );
  } else {
    throw new ValidationError(
      `Unknown transfer type for simulation: ${(norm as any).kind}`,
      "UNKNOWN_TRANSFER_TYPE"
    );
  }
}
