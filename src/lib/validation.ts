// lib/validation.ts - Intent validation and policy enforcement

import {
  createPublicClient,
  http,
  formatEther,
  formatUnits,
  erc20Abi,
  getContract,
} from "viem";
import type {
  NormalizedNativeTransfer,
  NormalizedERC20Transfer,
  NormalizedSwap,
  NormalizedBridge,
  NormalizedBridgeSwap,
  NormalizedIntent,
} from "./normalize";
import { getChainConfig, isChainSupported } from "./chains/registry";
import type { PolicyConfig } from "./policy/types";

export class ValidationError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Create public client for chain operations
 */
function getPublicClient(chainId: number) {
  if (!isChainSupported(chainId)) {
    throw new ValidationError(
      `Unsupported chainId: ${chainId}`,
      "CHAIN_UNSUPPORTED",
    );
  }

  const chainConfig = getChainConfig(chainId);
  if (!chainConfig) {
    throw new ValidationError(
      `Chain configuration not found for chainId: ${chainId}`,
      "CHAIN_CONFIG_MISSING",
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
 * Note: USD-based limit checking is now handled by checkPolicy() in policy/checker.ts
 */
function validateAmountLimits(amountWei: bigint, _policyConfig: PolicyConfig) {
  // Basic amount validation
  if (amountWei <= 0n) {
    throw new ValidationError(
      "Amount must be greater than 0",
      "AMOUNT_TOO_SMALL",
    );
  }

  // USD-based policy limits are checked in checkPolicy()
  // This function now only does basic validation
}

/**
 * Estimate gas for native transfer
 */
async function estimateTransferGas(
  norm: NormalizedNativeTransfer,
  fromAddress: `0x${string}`,
  policyConfig: PolicyConfig,
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
      Math.ceil(Number(gasEstimate) * policyConfig.gasHeadroomMultiplier),
    );
    return gasWithHeadroom;
  } catch {
    throw new ValidationError(
      "Failed to estimate gas for transaction",
      "GAS_ESTIMATION_FAILED",
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
      "GAS_PRICE_FAILED",
    );
  }
}

/**
 * Check basic balance before gas estimation
 */
async function checkBasicBalance(
  norm: NormalizedNativeTransfer,
  fromAddress: `0x${string}`,
): Promise<bigint> {
  const publicClient = getPublicClient(norm.chainId);
  const balance = await publicClient.getBalance({ address: fromAddress });

  // First check if we have enough balance for just the transfer amount
  console.log({ balance, amountWei: norm.amountWei });
  if (balance < norm.amountWei) {
    const chainConfig = getChainConfig(norm.chainId);
    const nativeSymbol = chainConfig?.nativeCurrency.symbol || "ETH";
    const balanceFormatted = formatEther(balance);
    const amountFormatted = formatEther(norm.amountWei);

    throw new ValidationError(
      `Insufficient balance. You have ${balanceFormatted} ${nativeSymbol} but trying to send ${amountFormatted} ${nativeSymbol}`,
      "INSUFFICIENT_FUNDS",
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
  balance: bigint,
  policyConfig: PolicyConfig,
): Promise<{ gasEstimate: bigint; gasCost: bigint }> {
  // Estimate gas and get gas price (now that we know basic balance is sufficient)
  const gasEstimate = await estimateTransferGas(
    norm,
    fromAddress,
    policyConfig,
  );
  const gasPrice = await getCurrentGasPrice(norm.chainId);
  const gasCost = gasEstimate * gasPrice;

  // Calculate total cost (amount + gas)
  const totalCost = norm.amountWei + gasCost;

  // Check if balance is sufficient for total cost
  console.log({ balance, totalCost });
  if (balance < totalCost) {
    const chainConfig = getChainConfig(norm.chainId);
    const nativeSymbol = chainConfig?.nativeCurrency.symbol || "ETH";
    const balanceFormatted = formatEther(balance);
    const totalCostFormatted = formatEther(totalCost);
    const gasCostFormatted = formatEther(gasCost);
    const amountFormatted = formatEther(norm.amountWei);

    throw new ValidationError(
      `Insufficient balance for transaction + gas. You have ${balanceFormatted} ${nativeSymbol} but need ${totalCostFormatted} ${nativeSymbol} (${amountFormatted} ${nativeSymbol} + ${gasCostFormatted} ${nativeSymbol} gas)`,
      "INSUFFICIENT_FUNDS_WITH_GAS",
    );
  }

  // Note: Minimum balance validation now handled by USD-based policy in checkPolicy()
  // This was checking minBalanceAfterTxETH which is now minBalanceAfterTxUSD

  return { gasEstimate, gasCost };
}

/**
 * Daily spend limits are now handled by the policy checker system
 * This function is kept for backward compatibility but does nothing
 */
async function validateDailySpendLimit(
  _norm: NormalizedNativeTransfer,
  _policyConfig: PolicyConfig,
): Promise<void> {
  // Handled by policy checker in checkPolicy()
  return;
}

/**
 * Main validation function
 * Returns gas estimates needed for execution
 */
export async function validateNativeTransfer(
  norm: NormalizedNativeTransfer,
  fromAddress: `0x${string}`,
  policyConfig: PolicyConfig,
): Promise<{ gasEstimate: bigint; gasCost: bigint }> {
  // Basic validation
  validateRecipient(norm.to);
  validateAmountLimits(norm.amountWei, policyConfig);

  // Check basic balance first (before gas estimation)
  const balance = await checkBasicBalance(norm, fromAddress);

  // Balance and gas validation (with known balance)
  const { gasEstimate, gasCost } = await validateBalance(
    norm,
    fromAddress,
    balance,
    policyConfig,
  );

  // Policy validation (daily limits now handled in policy checker)
  await validateDailySpendLimit(norm, policyConfig);

  return { gasEstimate, gasCost };
}

/**
 * Validate ERC-20 token transfer
 */
export async function validateERC20Transfer(
  norm: NormalizedERC20Transfer,
  fromAddress: `0x${string}`,
  policyConfig: PolicyConfig,
): Promise<{ gasEstimate: bigint; gasCost: bigint }> {
  // Basic validation
  validateRecipient(norm.to);

  // Validate token amount
  if (norm.amountWei <= 0n) {
    throw new ValidationError(
      "Amount must be greater than 0",
      "AMOUNT_TOO_SMALL",
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
        "INSUFFICIENT_TOKEN_BALANCE",
      );
    }

    // Estimate gas for ERC-20 transfer
    const gasEstimate = await publicClient.estimateContractGas({
      address: norm.token.address,
      abi: erc20Abi,
      functionName: "transfer",
      args: [norm.to, norm.amountWei],
      account: fromAddress,
    });

    // Add gas headroom for ERC-20 transfers (higher than native due to contract complexity)
    const gasWithHeadroom = BigInt(
      Math.ceil(Number(gasEstimate) * policyConfig.gasHeadroomMultiplier),
    );

    // Get current gas price
    const gasPrice = await getCurrentGasPrice(norm.chainId);
    const gasCost = gasWithHeadroom * gasPrice;

    // Check if user has enough native currency for gas
    const nativeBalance = await publicClient.getBalance({
      address: fromAddress,
    });

    if (nativeBalance < gasCost) {
      const chainConfig = getChainConfig(norm.chainId);
      const nativeSymbol = chainConfig?.nativeCurrency.symbol || "ETH";
      const gasCostFormatted = formatEther(gasCost);
      const nativeBalanceFormatted = formatEther(nativeBalance);

      throw new ValidationError(
        `Insufficient ${nativeSymbol} for gas fees. You need ${gasCostFormatted} ${nativeSymbol} for gas but only have ${nativeBalanceFormatted} ${nativeSymbol}`,
        "INSUFFICIENT_GAS_FUNDS",
      );
    }

    // Daily spend limits now handled by policy checker

    return { gasEstimate: gasWithHeadroom, gasCost };
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }

    // Handle contract call failures
    if (
      error.message?.includes("revert") ||
      error.message?.includes("execution reverted")
    ) {
      throw new ValidationError(
        `Token contract error: ${norm.token.symbol} transfer would fail`,
        "TOKEN_CONTRACT_ERROR",
      );
    }

    if (error.message?.includes("gas")) {
      throw new ValidationError(
        "Failed to estimate gas for token transfer",
        "GAS_ESTIMATION_FAILED",
      );
    }

    throw new ValidationError(
      `Token validation failed: ${error.message || "Unknown error"}`,
      "TOKEN_VALIDATION_FAILED",
    );
  }
}

/**
 * Simulate transaction before execution
 */
export async function simulateTransfer(
  norm: NormalizedNativeTransfer,
  fromAddress: `0x${string}`,
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
      "SIMULATION_FAILED",
    );
  }
}

/**
 * Simulate ERC-20 token transfer before execution
 */
export async function simulateERC20Transfer(
  norm: NormalizedERC20Transfer,
  fromAddress: `0x${string}`,
): Promise<void> {
  const publicClient = getPublicClient(norm.chainId);

  try {
    await publicClient.simulateContract({
      address: norm.token.address,
      abi: erc20Abi,
      functionName: "transfer",
      args: [norm.to, norm.amountWei],
      account: fromAddress,
    });
  } catch (error: any) {
    console.error("ERC-20 simulation error:", error);
    throw new ValidationError(
      `Token transfer simulation failed. Transaction would likely fail on-chain: ${error.shortMessage || error.message}`,
      "SIMULATION_FAILED",
    );
  }
}

/**
 * Validate swap intent - checks token balances on source chain
 */
export async function validateSwap(
  norm: NormalizedSwap,
  fromAddress: `0x${string}`,
  policyConfig: PolicyConfig,
): Promise<{ gasEstimate: bigint; gasCost: bigint }> {
  // Get public client for the chain
  const publicClient = getPublicClient(norm.fromChainId);

  try {
    // Check source token balance
    let balance: bigint;

    // For native tokens (ETH), use getBalance
    if (
      norm.fromToken.address === "0x0000000000000000000000000000000000000000"
    ) {
      balance = await publicClient.getBalance({ address: fromAddress });
    } else {
      // For ERC-20 tokens, use balanceOf
      const tokenContract = getContract({
        address: norm.fromToken.address,
        abi: erc20Abi,
        client: publicClient,
      });
      balance = await tokenContract.read.balanceOf([fromAddress]);
    }

    if (balance < norm.fromAmount) {
      const balanceFormatted = formatUnits(balance, norm.fromToken.decimals);
      const amountFormatted = formatUnits(
        norm.fromAmount,
        norm.fromToken.decimals,
      );

      throw new ValidationError(
        `Insufficient ${norm.fromToken.symbol} balance. You have ${balanceFormatted} but trying to swap ${amountFormatted}`,
        "INSUFFICIENT_TOKEN_BALANCE",
      );
    }

    // Check native token balance for gas
    const nativeBalance = await publicClient.getBalance({
      address: fromAddress,
    });
    const chainConfig = getChainConfig(norm.fromChainId);

    // Estimate gas (rough estimate for approval + swap)
    const estimatedGas = 300000n; // Conservative estimate for DEX swaps
    const gasPrice = await publicClient.getGasPrice();
    const gasCost =
      (estimatedGas *
        gasPrice *
        BigInt(Math.floor(policyConfig.gasHeadroomMultiplier * 100))) /
      100n;

    if (nativeBalance < gasCost) {
      const nativeSymbol = chainConfig?.nativeCurrency.symbol || "ETH";
      throw new ValidationError(
        `Insufficient ${nativeSymbol} for gas fees. Need ~${formatEther(gasCost)} ${nativeSymbol}`,
        "INSUFFICIENT_GAS_FUNDS",
      );
    }

    return { gasEstimate: estimatedGas, gasCost };
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      `Swap validation failed: ${error.message || "Unknown error"}`,
      "SWAP_VALIDATION_FAILED",
    );
  }
}

/**
 * Validate bridge intent - checks token balance on source chain
 */
export async function validateBridge(
  norm: NormalizedBridge,
  fromAddress: `0x${string}`,
  policyConfig: PolicyConfig,
): Promise<{ gasEstimate: bigint; gasCost: bigint }> {
  // Get public client for source chain
  const publicClient = getPublicClient(norm.fromChainId);

  try {
    // Check source token balance
    let balance: bigint;

    // For native tokens (ETH), use getBalance
    if (norm.token.address === "0x0000000000000000000000000000000000000000") {
      balance = await publicClient.getBalance({ address: fromAddress });
    } else {
      // For ERC-20 tokens, use balanceOf
      const tokenContract = getContract({
        address: norm.token.address,
        abi: erc20Abi,
        client: publicClient,
      });
      balance = await tokenContract.read.balanceOf([fromAddress]);
    }

    if (balance < norm.amount) {
      const balanceFormatted = formatUnits(balance, norm.token.decimals);
      const amountFormatted = formatUnits(norm.amount, norm.token.decimals);

      throw new ValidationError(
        `Insufficient ${norm.token.symbol} balance. You have ${balanceFormatted} but trying to bridge ${amountFormatted}`,
        "INSUFFICIENT_TOKEN_BALANCE",
      );
    }

    // Check native token balance for gas
    const nativeBalance = await publicClient.getBalance({
      address: fromAddress,
    });
    const chainConfig = getChainConfig(norm.fromChainId);

    // Estimate gas (rough estimate for approval + bridge)
    const estimatedGas = 250000n; // Conservative estimate for bridges
    const gasPrice = await publicClient.getGasPrice();
    const gasCost =
      (estimatedGas *
        gasPrice *
        BigInt(Math.floor(policyConfig.gasHeadroomMultiplier * 100))) /
      100n;

    if (nativeBalance < gasCost) {
      const nativeSymbol = chainConfig?.nativeCurrency.symbol || "ETH";
      throw new ValidationError(
        `Insufficient ${nativeSymbol} for gas fees. Need ~${formatEther(gasCost)} ${nativeSymbol}`,
        "INSUFFICIENT_GAS_FUNDS",
      );
    }

    return { gasEstimate: estimatedGas, gasCost };
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      `Bridge validation failed: ${error.message || "Unknown error"}`,
      "BRIDGE_VALIDATION_FAILED",
    );
  }
}

/**
 * Validate bridge-swap intent - checks token balance on source chain
 */
export async function validateBridgeSwap(
  norm: NormalizedBridgeSwap,
  fromAddress: `0x${string}`,
  policyConfig: PolicyConfig,
): Promise<{ gasEstimate: bigint; gasCost: bigint }> {
  // Get public client for source chain
  const publicClient = getPublicClient(norm.fromChainId);

  try {
    // Check source token balance
    let balance: bigint;

    // For native tokens (ETH), use getBalance
    if (
      norm.fromToken.address === "0x0000000000000000000000000000000000000000"
    ) {
      balance = await publicClient.getBalance({ address: fromAddress });
    } else {
      // For ERC-20 tokens, use balanceOf
      const tokenContract = getContract({
        address: norm.fromToken.address,
        abi: erc20Abi,
        client: publicClient,
      });
      balance = await tokenContract.read.balanceOf([fromAddress]);
    }

    if (balance < norm.fromAmount) {
      const balanceFormatted = formatUnits(balance, norm.fromToken.decimals);
      const amountFormatted = formatUnits(
        norm.fromAmount,
        norm.fromToken.decimals,
      );

      throw new ValidationError(
        `Insufficient ${norm.fromToken.symbol} balance. You have ${balanceFormatted} but trying to bridge-swap ${amountFormatted}`,
        "INSUFFICIENT_TOKEN_BALANCE",
      );
    }

    // Check native token balance for gas
    const nativeBalance = await publicClient.getBalance({
      address: fromAddress,
    });
    const chainConfig = getChainConfig(norm.fromChainId);

    // Estimate gas (rough estimate for approval + bridge + swap)
    const estimatedGas = 400000n; // Conservative estimate for complex bridge-swaps
    const gasPrice = await publicClient.getGasPrice();
    const gasCost =
      (estimatedGas *
        gasPrice *
        BigInt(Math.floor(policyConfig.gasHeadroomMultiplier * 100))) /
      100n;

    if (nativeBalance < gasCost) {
      const nativeSymbol = chainConfig?.nativeCurrency.symbol || "ETH";
      throw new ValidationError(
        `Insufficient ${nativeSymbol} for gas fees. Need ~${formatEther(gasCost)} ${nativeSymbol}`,
        "INSUFFICIENT_GAS_FUNDS",
      );
    }

    return { gasEstimate: estimatedGas, gasCost };
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      `Bridge-swap validation failed: ${error.message || "Unknown error"}`,
      "BRIDGE_SWAP_VALIDATION_FAILED",
    );
  }
}

/**
 * Validation router for different intent types
 */
export async function validateIntent(
  norm: NormalizedIntent,
  fromAddress: `0x${string}`,
  policyConfig: PolicyConfig,
): Promise<{ gasEstimate: bigint; gasCost: bigint }> {
  if (norm.kind === "native-transfer") {
    return validateNativeTransfer(norm, fromAddress, policyConfig);
  } else if (norm.kind === "erc20-transfer") {
    return validateERC20Transfer(norm, fromAddress, policyConfig);
  } else if (norm.kind === "swap") {
    return validateSwap(norm, fromAddress, policyConfig);
  } else if (norm.kind === "bridge") {
    return validateBridge(norm, fromAddress, policyConfig);
  } else if (norm.kind === "bridge-swap") {
    return validateBridgeSwap(norm, fromAddress, policyConfig);
  } else {
    throw new ValidationError(
      `Unknown transfer type: ${(norm as any).kind}`,
      "UNKNOWN_TRANSFER_TYPE",
    );
  }
}

/**
 * Simulation router for different intent types
 */
export async function simulateIntent(
  norm: NormalizedIntent,
  fromAddress: `0x${string}`,
): Promise<void> {
  if (norm.kind === "native-transfer") {
    return simulateTransfer(norm, fromAddress);
  } else if (norm.kind === "erc20-transfer") {
    return simulateERC20Transfer(norm, fromAddress);
  } else if (
    norm.kind === "swap" ||
    norm.kind === "bridge" ||
    norm.kind === "bridge-swap"
  ) {
    // Skip simulation for LI.FI-based operations (they have their own validation)
    console.log(
      `⏭️ Skipping simulation for ${norm.kind} (uses LI.FI validation)`,
    );
    return;
  } else {
    throw new ValidationError(
      `Unknown transfer type for simulation: ${(norm as any).kind}`,
      "UNKNOWN_TRANSFER_TYPE",
    );
  }
}
