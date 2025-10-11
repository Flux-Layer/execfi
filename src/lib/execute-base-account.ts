/**
 * Base Account Execution Module
 * 
 * Handles transaction execution using Base Account SDK via wallet_sendCalls (EIP-5792).
 * Supports native transfers, ERC-20 transfers, and batch transactions.
 * Includes conditional Paymaster support for gas sponsorship.
 */

import { formatEther, formatUnits, numberToHex, encodeFunctionData } from 'viem';
import type {
  NormalizedNativeTransfer,
  NormalizedERC20Transfer,
  NormalizedIntent,
} from './normalize';
import { ExecutionError, type ExecutionResult } from './execute';
import { getTxUrl, formatSuccessMessage } from './explorer';
import { getChainConfig } from './chains/registry';
import { getPaymasterConfig } from './config/base-account';

/**
 * Execute native ETH transfer using Base Account
 */
export async function executeNativeTransferWithBaseAccount(
  norm: NormalizedNativeTransfer,
  provider: any,
  fromAddress: `0x${string}`,
): Promise<ExecutionResult> {
  try {
    console.log('🔄 Executing native transfer via Base Account...', {
      to: norm.to,
      amount: formatEther(norm.amountWei),
      chainId: norm.chainId,
    });

    const paymasterConfig = getPaymasterConfig();
    const shouldSponsorGas = 
      paymasterConfig.enabled &&
      paymasterConfig.sponsoredChains?.includes(norm.chainId) &&
      paymasterConfig.sponsoredOperations?.includes('transfer');

    // Prepare transaction call
    const calls = [{
      to: norm.to as `0x${string}`,
      value: numberToHex(norm.amountWei),
      data: '0x' as `0x${string}`,
    }];

    // Build params
    const params: any = {
      version: '1.0',
      chainId: numberToHex(norm.chainId),
      from: fromAddress,
      calls,
    };

    // Conditionally add paymaster
    if (shouldSponsorGas && paymasterConfig.proxyUrl) {
      params.capabilities = {
        paymasterService: {
          url: paymasterConfig.proxyUrl,
        },
      };
      console.log('🎁 Gas sponsorship enabled for this transaction');
    } else {
      console.log('💰 User will pay gas for this transaction');
    }

    // Execute via wallet_sendCalls
    const result = await provider.request({
      method: 'wallet_sendCalls',
      params: [params],
    });

    const txHash = result as string;

    if (!txHash || typeof txHash !== 'string') {
      throw new ExecutionError(
        'Transaction failed: No transaction hash returned',
        'NO_TX_HASH',
      );
    }

    console.log('✅ Transaction submitted via Base Account:', txHash);

    const amount = formatEther(norm.amountWei);
    const message = formatSuccessMessage(amount, norm.chainId, txHash);
    const explorerUrl = getTxUrl(norm.chainId, txHash);

    return {
      success: true,
      txHash,
      message,
      explorerUrl,
    };
  } catch (error: any) {
    console.error('❌ Base Account execution failed:', error);

    if (error.code === 4001) {
      throw new ExecutionError('User rejected transaction', 'USER_REJECTED');
    }

    if (error.message?.includes('insufficient funds')) {
      throw new ExecutionError(
        'Insufficient balance for transaction + gas fees',
        'INSUFFICIENT_FUNDS',
      );
    }

    throw new ExecutionError(
      `Transaction execution failed: ${error.message || 'Unknown error'}`,
      'EXECUTION_FAILED',
    );
  }
}

/**
 * Execute ERC-20 token transfer using Base Account
 */
export async function executeERC20TransferWithBaseAccount(
  norm: NormalizedERC20Transfer,
  provider: any,
  fromAddress: `0x${string}`,
): Promise<ExecutionResult> {
  try {
    console.log('🔄 Executing ERC-20 transfer via Base Account...', {
      token: norm.token.symbol,
      to: norm.to,
      amount: formatUnits(norm.amountWei, norm.token.decimals),
      chainId: norm.chainId,
    });

    const data = encodeFunctionData({
      abi: [{
        name: 'transfer',
        type: 'function',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
      }],
      functionName: 'transfer',
      args: [norm.to as `0x${string}`, norm.amountWei],
    });

    const paymasterConfig = getPaymasterConfig();
    const shouldSponsorGas = 
      paymasterConfig.enabled &&
      paymasterConfig.sponsoredChains?.includes(norm.chainId) &&
      paymasterConfig.sponsoredOperations?.includes('transfer');

    const calls = [{
      to: norm.token.address as `0x${string}`,
      value: '0x0',
      data,
    }];

    const params: any = {
      version: '1.0',
      chainId: numberToHex(norm.chainId),
      from: fromAddress,
      calls,
    };

    if (shouldSponsorGas && paymasterConfig.proxyUrl) {
      params.capabilities = {
        paymasterService: {
          url: paymasterConfig.proxyUrl,
        },
      };
      console.log('🎁 Gas sponsorship enabled for this transaction');
    }

    const result = await provider.request({
      method: 'wallet_sendCalls',
      params: [params],
    });

    const txHash = result as string;

    const chainConfig = getChainConfig(norm.chainId);
    const explorerUrl = `${chainConfig?.explorerUrl}/tx/${txHash}`;
    const amountFormatted = formatUnits(norm.amountWei, norm.token.decimals);

    return {
      success: true,
      txHash,
      explorerUrl,
      message: `✅ Sent ${amountFormatted} ${norm.token.symbol} on ${chainConfig?.name}`,
    };
  } catch (error: any) {
    console.error('❌ Base Account ERC-20 execution failed:', error);

    if (error.code === 4001) {
      throw new ExecutionError('User rejected transaction', 'USER_REJECTED');
    }

    throw new ExecutionError(
      `ERC-20 transfer failed: ${error.message || 'Unknown error'}`,
      'EXECUTION_FAILED',
    );
  }
}

/**
 * Execute batch transactions using Base Account
 * 
 * This enables multiple operations in a single transaction using EIP-5792.
 * All calls succeed atomically or all fail.
 */
export async function executeBatchWithBaseAccount(
  calls: Array<{
    to: `0x${string}`;
    value: string;
    data: `0x${string}`;
  }>,
  chainId: number,
  provider: any,
  fromAddress: `0x${string}`,
): Promise<ExecutionResult> {
  try {
    console.log(`🔄 Executing ${calls.length} transactions in batch via Base Account...`);

    const paymasterConfig = getPaymasterConfig();
    const shouldSponsorGas = 
      paymasterConfig.enabled &&
      paymasterConfig.sponsoredChains?.includes(chainId);

    const params: any = {
      version: '1.0',
      chainId: numberToHex(chainId),
      from: fromAddress,
      calls,
      atomicRequired: true, // All succeed or all fail
    };

    if (shouldSponsorGas && paymasterConfig.proxyUrl) {
      params.capabilities = {
        paymasterService: {
          url: paymasterConfig.proxyUrl,
        },
      };
      console.log('🎁 Gas sponsorship enabled for batch transaction');
    }

    const result = await provider.request({
      method: 'wallet_sendCalls',
      params: [params],
    });

    const txHash = result as string;
    const chainConfig = getChainConfig(chainId);
    const explorerUrl = `${chainConfig?.explorerUrl}/tx/${txHash}`;

    return {
      success: true,
      txHash,
      explorerUrl,
      message: `✅ Batch of ${calls.length} transactions executed on ${chainConfig?.name}`,
    };
  } catch (error: any) {
    console.error('❌ Base Account batch execution failed:', error);

    if (error.code === 4001) {
      throw new ExecutionError('User rejected batch transaction', 'USER_REJECTED');
    }

    throw new ExecutionError(
      `Batch execution failed: ${error.message || 'Unknown error'}`,
      'EXECUTION_FAILED',
    );
  }
}

/**
 * Main router for Base Account execution
 * 
 * Routes normalized intents to the appropriate execution function.
 */
export async function executeIntentWithBaseAccount(
  norm: NormalizedIntent,
  provider: any,
  fromAddress: `0x${string}`,
): Promise<ExecutionResult> {
  if (norm.kind === 'native-transfer') {
    return executeNativeTransferWithBaseAccount(norm, provider, fromAddress);
  } else if (norm.kind === 'erc20-transfer') {
    return executeERC20TransferWithBaseAccount(norm, provider, fromAddress);
  } else {
    throw new ExecutionError(
      `Base Account does not support ${norm.kind} operations yet. Use EOA or Smart Account mode for swaps and bridges.`,
      'UNSUPPORTED_OPERATION',
    );
  }
}
