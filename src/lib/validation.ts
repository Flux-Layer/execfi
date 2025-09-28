// lib/validation.ts - Intent validation and policy enforcement

import { createPublicClient, http, formatEther, formatUnits, erc20Abi, getContract } from "viem";
import type { NormalizedNativeTransfer, NormalizedERC20Transfer, NormalizedIntent } from "./normalize";
import { getChainConfig, isChainSupported } from "./chains/registry";

export class ValidationError extends Error {
   constructor(message: string, public code: string) {
      super(message);
      this.name = "ValidationError";
   }
}

// Chain configuration now dynamically retrieved from registry

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
   if (!isChainSupported(chainId)) {
      throw new ValidationError(
         `Unsupported chainId: ${chainId}`,
         "CHAIN_UNSUPPORTED"
      );
   }

   const chainConfig = getChainConfig(chainId);
   if (!chainConfig) {
      throw new ValidationError(
         `Chain configuration not found for chainId: ${chainId}`,
         "CHAIN_CONFIG_MISSING"
      );
   }

   return createPublicClient({
      chain: chainConfig.wagmiChain,
      transport: http(chainConfig.rpcUrl),
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
      const chainConfig = getChainConfig(norm.chainId);
      const nativeSymbol = chainConfig?.nativeCurrency.symbol || "ETH";
      const balanceFormatted = formatEther(balance);
      const amountFormatted = formatEther(norm.amountWei);

      throw new ValidationError(
         `Insufficient balance. You have ${balanceFormatted} ${nativeSymbol} but trying to send ${amountFormatted} ${nativeSymbol}`,
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
      const chainConfig = getChainConfig(norm.chainId);
      const nativeSymbol = chainConfig?.nativeCurrency.symbol || "ETH";
      const balanceFormatted = formatEther(balance);
      const totalCostFormatted = formatEther(totalCost);
      const gasCostFormatted = formatEther(gasCost);
      const amountFormatted = formatEther(norm.amountWei);

      throw new ValidationError(
         `Insufficient balance for transaction + gas. You have ${balanceFormatted} ${nativeSymbol} but need ${totalCostFormatted} ${nativeSymbol} (${amountFormatted} ${nativeSymbol} + ${gasCostFormatted} ${nativeSymbol} gas)`,
         "INSUFFICIENT_FUNDS_WITH_GAS"
      );
   }

   // Check minimum balance after transaction
   const balanceAfterTx = balance - totalCost;
   const minBalanceWei = BigInt(
      Math.floor(POLICY.MIN_BALANCE_AFTER_TX_ETH * 1e18)
   );

   if (balanceAfterTx < minBalanceWei) {
      const chainConfig = getChainConfig(norm.chainId);
      const nativeSymbol = chainConfig?.nativeCurrency.symbol || "ETH";
      const balanceAfterFormatted = formatEther(balanceAfterTx);
      throw new ValidationError(
         `Transaction would leave balance too low (${balanceAfterFormatted} ${nativeSymbol}). Minimum ${POLICY.MIN_BALANCE_AFTER_TX_ETH} ${nativeSymbol} required`,
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
 * Validate ERC-20 token transfer
 */
export async function validateERC20Transfer(
  norm: NormalizedERC20Transfer,
  fromAddress: `0x${string}`
): Promise<{ gasEstimate: bigint; gasCost: bigint }> {
  // Basic validation
  validateRecipient(norm.to);

  // Validate token amount
  if (norm.amountWei <= 0n) {
    throw new ValidationError(
      "Amount must be greater than 0",
      "AMOUNT_TOO_SMALL"
    );
  }

  // Get public client for chain operations
  const publicClient = getPublicClient(norm.chainId);

  // Create ERC-20 contract instance
  const tokenContract = getContract({
    address: norm.token.address,
    abi: erc20Abi,
    client: publicClient,
  });

  try {
    // Check token balance
    const balance = await tokenContract.read.balanceOf([fromAddress]);

    if (balance < norm.amountWei) {
      const balanceFormatted = formatUnits(balance, norm.token.decimals);
      const amountFormatted = formatUnits(norm.amountWei, norm.token.decimals);

      throw new ValidationError(
        `Insufficient ${norm.token.symbol} balance. You have ${balanceFormatted} ${norm.token.symbol} but trying to send ${amountFormatted} ${norm.token.symbol}`,
        "INSUFFICIENT_TOKEN_BALANCE"
      );
    }

    // Estimate gas for ERC-20 transfer
    const gasEstimate = await publicClient.estimateContractGas({
      address: norm.token.address,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [norm.to, norm.amountWei],
      account: fromAddress,
    });

    // Add gas headroom for ERC-20 transfers (higher than native due to contract complexity)
    const gasWithHeadroom = BigInt(
      Math.ceil(Number(gasEstimate) * POLICY.GAS_HEADROOM_MULT)
    );

    // Get current gas price
    const gasPrice = await getCurrentGasPrice(norm.chainId);
    const gasCost = gasWithHeadroom * gasPrice;

    // Check if user has enough native currency for gas
    const nativeBalance = await publicClient.getBalance({ address: fromAddress });

    if (nativeBalance < gasCost) {
      const chainConfig = getChainConfig(norm.chainId);
      const nativeSymbol = chainConfig?.nativeCurrency.symbol || "ETH";
      const gasCostFormatted = formatEther(gasCost);
      const nativeBalanceFormatted = formatEther(nativeBalance);

      throw new ValidationError(
        `Insufficient ${nativeSymbol} for gas fees. You need ${gasCostFormatted} ${nativeSymbol} for gas but only have ${nativeBalanceFormatted} ${nativeSymbol}`,
        "INSUFFICIENT_GAS_FUNDS"
      );
    }

    // Validate daily spend limits (convert to ETH equivalent for policy)
    const tokenAmountFormatted = formatUnits(norm.amountWei, norm.token.decimals);
    const tokenAmountEth = parseFloat(tokenAmountFormatted); // Simplified - in production would need price oracle

    if (tokenAmountEth > POLICY.DAILY_SPEND_LIMIT_ETH) {
      throw new ValidationError(
        `Transaction amount ${tokenAmountFormatted} ${norm.token.symbol} exceeds daily limit`,
        "DAILY_LIMIT_EXCEEDED"
      );
    }

    return { gasEstimate: gasWithHeadroom, gasCost };

  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }

    // Handle contract call failures
    if (error.message?.includes("revert") || error.message?.includes("execution reverted")) {
      throw new ValidationError(
        `Token contract error: ${norm.token.symbol} transfer would fail`,
        "TOKEN_CONTRACT_ERROR"
      );
    }

    if (error.message?.includes("gas")) {
      throw new ValidationError(
        "Failed to estimate gas for token transfer",
        "GAS_ESTIMATION_FAILED"
      );
    }

    throw new ValidationError(
      `Token validation failed: ${error.message || "Unknown error"}`,
      "TOKEN_VALIDATION_FAILED"
    );
  }
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
 * Simulate ERC-20 token transfer before execution
 */
export async function simulateERC20Transfer(
  norm: NormalizedERC20Transfer,
  fromAddress: `0x${string}`
): Promise<void> {
  const publicClient = getPublicClient(norm.chainId);

  try {
    await publicClient.simulateContract({
      address: norm.token.address,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [norm.to, norm.amountWei],
      account: fromAddress,
    });
  } catch (error: any) {
    console.error("ERC-20 simulation error:", error);
    throw new ValidationError(
      `Token transfer simulation failed. Transaction would likely fail on-chain: ${error.shortMessage || error.message}`,
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
    return validateERC20Transfer(norm, fromAddress);
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
    return simulateERC20Transfer(norm, fromAddress);
  } else {
    throw new ValidationError(
      `Unknown transfer type for simulation: ${(norm as any).kind}`,
      "UNKNOWN_TRANSFER_TYPE"
    );
  }
}
