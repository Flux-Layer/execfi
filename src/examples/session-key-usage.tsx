// Example: How to use session keys for automated transaction signing

import useBiconomyWithSessionKey from "@hooks/useBiconomyWithSessionKey";
import { executeTransferPipeline } from "../lib/execute";
import type { NormalizedNativeTransfer } from "../lib/normalize";

export function SessionKeyExample() {
  const {
    sessionClient,
    isSessionActive,
    createSession,
    sendTxWithSession
  } = useBiconomyWithSessionKey();

  // Method 1: Using the hook's sendTxWithSession method (recommended)
  const sendAutomaticTransaction = async () => {
    if (!isSessionActive) {
      // Create session first
      await createSession(24); // 24 hours
    }

    // This transaction will be signed automatically without user interaction
    const hash = await sendTxWithSession({
      to: "0x742D35Cc6234B8D4d1d58FC5c3F6b5BD2c47a31B",
      value: "1000000000000000", // 0.001 ETH in wei
    });

    console.log("Automatic transaction sent:", hash);
    return hash;
  };

  // Method 2: Using the executeTransferPipeline with session flag
  const sendAutomaticTransferViaPipeline = async () => {
    if (!isSessionActive || !sessionClient) {
      throw new Error("Session not active or client not ready");
    }

    // Create normalized transfer manually
    const normalizedTransfer: NormalizedNativeTransfer = {
      kind: "native-transfer",
      chainId: 8453, // Base
      to: "0x742D35Cc6234B8D4d1d58FC5c3F6b5BD2c47a31B",
      amountWei: BigInt("1000000000000000") // 0.001 ETH in wei
    };

    // Execute with session client
    const result = await executeTransferPipeline(
      sessionClient,
      normalizedTransfer,
      { useSession: true }
    );

    console.log("Pipeline session transaction sent:", result.txHash);
    return result.txHash;
  };

  // Method 3: Batch multiple transactions automatically
  const sendBatchTransactions = async () => {
    if (!isSessionActive) {
      await createSession(24);
    }

    const transactions = [
      {
        to: "0x742D35Cc6234B8D4d1d58FC5c3F6b5BD2c47a31B",
        value: "1000000000000000", // 0.001 ETH
      },
      {
        to: "0x000000000000000000000000000000000000dEaD",
        value: "500000000000000", // 0.0005 ETH
      }
    ];

    const hashes = [];
    for (const tx of transactions) {
      try {
        const hash = await sendTxWithSession(tx);
        hashes.push(hash);
        console.log(`Batch transaction ${hashes.length} sent:`, hash);

        // Wait a bit between transactions to avoid nonce issues
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Batch transaction ${hashes.length + 1} failed:`, error);
      }
    }

    return hashes;
  };

  return {
    sendAutomaticTransaction,
    sendAutomaticTransferViaPipeline,
    sendBatchTransactions
  };
}

// Example: Automated DeFi operations
export function AutomatedDeFiExample() {
  const { isSessionActive, createSession, sendTxWithSession } = useBiconomyWithSessionKey();

  const setupAutomatedTrading = async () => {
    // Create a session for automated trading
    await createSession(12); // 12 hours for trading session

    // Example: Automated token swaps, lending, etc.
    // This would integrate with your DeFi protocols
    console.log("Automated trading session created");
  };

  const executeAutomatedStrategy = async () => {
    if (!isSessionActive) {
      throw new Error("Trading session expired. Please create a new session.");
    }

    // Example: Automated rebalancing without user approval
    const rebalanceTx = await sendTxWithSession({
      to: "0x1234567890123456789012345678901234567890", // Protocol contract
      value: "0",
      data: "0x...", // Encoded function call
    });

    console.log("Automated rebalancing executed:", rebalanceTx);
    return rebalanceTx;
  };

  return {
    setupAutomatedTrading,
    executeAutomatedStrategy
  };
}

// Example usage in a React component
export function SessionKeyComponent() {
  const { sendAutomaticTransaction } = SessionKeyExample();

  return (
    <button
      onClick={sendAutomaticTransaction}
      className="bg-green-500 text-white px-4 py-2 rounded"
    >
      Send Transaction Automatically
    </button>
  );
}