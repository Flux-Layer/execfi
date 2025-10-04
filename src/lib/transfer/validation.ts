// lib/transfer/validation.ts - Transfer-specific validation (isolated)

import {
  createPublicClient,
  http,
  formatEther,
  formatUnits,
  erc20Abi,
  getContract,
} from "viem";
import type { NormalizedTransfer } from "./types";
import { TransferValidationError } from "./errors";
import { getChainConfig, isChainSupported } from "../chains/registry";
import type { PolicyConfig } from "../policy/types";

/**
 * Create public client for chain operations
 */
function getPublicClient(chainId: number) {
  if (!isChainSupported(chainId)) {
    throw new TransferValidationError(
      `Unsupported chainId: ${chainId}`,
      "CHAIN_UNSUPPORTED"
    );
  }

  const chainConfig = getChainConfig(chainId);
  if (!chainConfig) {
    throw new TransferValidationError(
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
 * Validate recipient address
 */
function validateRecipient(to: `0x${string}`) {
  if (to === "0x0000000000000000000000000000000000000000") {
    throw new TransferValidationError("Cannot send to zero address", "ZERO_ADDRESS");
  }
}

/**
 * Validate amount is within policy limits
 * Note: USD-based limit checking is now handled by checkPolicy() in policy/checker.ts
 */
function validateAmountLimits(amountWei: bigint, _policyConfig: PolicyConfig) {
  // Basic amount validation
  if (amountWei <= 0n) {
    throw new TransferValidationError(
      "Amount must be greater than 0",
      "AMOUNT_TOO_SMALL"
    );
  }

  // USD-based policy limits are checked in checkPolicy()
  // This function now only does basic validation
}

/**
 * Validate native transfer
 */
async function validateNativeTransfer(
  norm: NormalizedTransfer & { kind: "native-transfer" },
  fromAddress: `0x${string}`,
  policyConfig: PolicyConfig
): Promise<{ gasEstimate: bigint; gasCost: bigint }> {
  const publicClient = getPublicClient(norm.chainId);

  // Check balance
  const balance = await publicClient.getBalance({ address: fromAddress });

  if (balance < norm.amountWei) {
    const chainConfig = getChainConfig(norm.chainId);
    const nativeSymbol = chainConfig?.nativeCurrency.symbol || "ETH";
    throw new TransferValidationError(
      `Insufficient balance. You have ${formatEther(balance)} ${nativeSymbol} but trying to send ${formatEther(norm.amountWei)} ${nativeSymbol}`,
      "INSUFFICIENT_FUNDS"
    );
  }

  // Estimate gas
  try {
    const gasEstimate = await publicClient.estimateGas({
      account: fromAddress,
      to: norm.to,
      value: norm.amountWei,
    });

    const gasWithHeadroom = BigInt(
      Math.ceil(Number(gasEstimate) * policyConfig.gasHeadroomMultiplier)
    );

    const gasPrice = await publicClient.getGasPrice();
    const gasCost = gasWithHeadroom * gasPrice;

    // Check total cost
    const totalCost = norm.amountWei + gasCost;
    if (balance < totalCost) {
      const chainConfig = getChainConfig(norm.chainId);
      const nativeSymbol = chainConfig?.nativeCurrency.symbol || "ETH";
      throw new TransferValidationError(
        `Insufficient balance for transaction + gas. You have ${formatEther(balance)} ${nativeSymbol} but need ${formatEther(totalCost)} ${nativeSymbol}`,
        "INSUFFICIENT_FUNDS_WITH_GAS"
      );
    }

    return { gasEstimate: gasWithHeadroom, gasCost };
  } catch (error) {
    throw new TransferValidationError(
      "Failed to estimate gas for transaction",
      "GAS_ESTIMATION_FAILED"
    );
  }
}

/**
 * Validate ERC-20 transfer
 */
async function validateERC20Transfer(
  norm: NormalizedTransfer & { kind: "erc20-transfer" },
  fromAddress: `0x${string}`,
  policyConfig: PolicyConfig
): Promise<{ gasEstimate: bigint; gasCost: bigint }> {
  const publicClient = getPublicClient(norm.chainId);

  // Check token balance
  const tokenContract = getContract({
    address: norm.token.address,
    abi: erc20Abi,
    client: publicClient,
  });

  const tokenBalance = await tokenContract.read.balanceOf([fromAddress]);

  if (tokenBalance < norm.amountWei) {
    throw new TransferValidationError(
      `Insufficient ${norm.token.symbol} balance. You have ${formatUnits(tokenBalance, norm.token.decimals)} but trying to send ${formatUnits(norm.amountWei, norm.token.decimals)}`,
      "INSUFFICIENT_TOKEN_BALANCE"
    );
  }

  // Check native balance for gas
  const nativeBalance = await publicClient.getBalance({ address: fromAddress });

  // Estimate gas
  try {
    const gasEstimate = await publicClient.estimateContractGas({
      address: norm.token.address,
      abi: erc20Abi,
      functionName: "transfer",
      args: [norm.to, norm.amountWei],
      account: fromAddress,
    });

    const gasWithHeadroom = BigInt(
      Math.ceil(Number(gasEstimate) * policyConfig.gasHeadroomMultiplier)
    );

    const gasPrice = await publicClient.getGasPrice();
    const gasCost = gasWithHeadroom * gasPrice;

    // Check native balance for gas
    if (nativeBalance < gasCost) {
      const chainConfig = getChainConfig(norm.chainId);
      const nativeSymbol = chainConfig?.nativeCurrency.symbol || "ETH";
      throw new TransferValidationError(
        `Insufficient ${nativeSymbol} for gas. You have ${formatEther(nativeBalance)} but need ${formatEther(gasCost)}`,
        "INSUFFICIENT_FUNDS_FOR_GAS"
      );
    }

    return { gasEstimate: gasWithHeadroom, gasCost };
  } catch (error) {
    throw new TransferValidationError(
      "Failed to estimate gas for ERC-20 transfer",
      "GAS_ESTIMATION_FAILED"
    );
  }
}

/**
 * Main validation function for transfers
 */
export async function validateTransfer(
  norm: NormalizedTransfer,
  fromAddress: `0x${string}`,
  policyConfig: PolicyConfig
): Promise<{ gasEstimate: bigint; gasCost: bigint }> {
  console.log("🔍 [Transfer] Validating transfer:", norm);

  // Basic validation
  validateRecipient(norm.to);
  validateAmountLimits(norm.amountWei, policyConfig);

  // Type-specific validation
  if (norm.kind === "native-transfer") {
    return await validateNativeTransfer(norm, fromAddress, policyConfig);
  } else {
    return await validateERC20Transfer(norm, fromAddress, policyConfig);
  }
}
