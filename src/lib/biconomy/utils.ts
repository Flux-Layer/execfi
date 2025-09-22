import {
  createSmartAccountClient,
  BiconomySmartAccountV2,
  PaymasterMode,
} from "@biconomy/account";
import { ConnectedWallet } from "@privy-io/react-auth";
import {
  Address,
  createPublicClient,
  createWalletClient,
  custom,
  http,
  toBytes,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import { SmartAccountConfig, SmartAccountError } from "./types";
import { getBiconomyConfig, isChainSupported } from "./config";
import { logDeep } from "../utils/logdeep";
import { type Account } from "viem";
import { rpc } from "viem/utils";

// Helper function to get Viem chain object from chainId
const getViemChain = (chainId: number) => {
  switch (chainId) {
    case base.id:
      return base;
    case baseSepolia.id:
      return baseSepolia;
    default:
      throw new SmartAccountError(`Unsupported chain ID for Viem: ${chainId}`);
  }
};

export const createBiconomySmartAccount = async (
  signer: ConnectedWallet,
  chainId: number,
  enablePaymaster: boolean = true
): Promise<BiconomySmartAccountV2> => {
  try {
    // Validate chain support
    if (!isChainSupported(chainId)) {
      throw new SmartAccountError(`Unsupported chain ID: ${chainId}`);
    }

    // Get configuration
    const config = getBiconomyConfig(chainId);

    // Get Ethereum provider from Privy wallet
    const ethereumProvider = await signer.getEthereumProvider();

    console.log("requesting accounts");
    await ethereumProvider?.request({ method: "eth_requestAccounts" });

    const accounts = await ethereumProvider?.request({
      method: "eth_accounts",
    });
    console.log({ accounts });

    const account: Address = accounts?.[0];
    console.log({ account });

    console.log({ signer });
    // Create Viem wallet client that Biconomy expects
    const viemChain = getViemChain(chainId);

    const walletClient = createWalletClient({
      account,
      transport: custom(ethereumProvider),
      chain: viemChain,
    });
    console.log({ walletClient });

    const rpcUrl =
      chainId === base.id
        ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`
        : `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`;
    // Create smart account client with proper signer
    const smartAccountClient = await createSmartAccountClient({
      signer: walletClient,
      bundlerUrl: config.bundlerUrl,
      biconomyPaymasterApiKey: enablePaymaster
        ? config.paymasterApiKey
        : undefined,
      chainId: chainId,
      rpcUrl,
    });
    console.log({ smartAccountClient });
    const address = await smartAccountClient.getAccountAddress(); // counterfactual SA address
    const initCode = await smartAccountClient.getAccountInitCode?.();
    console.log({ address, initCode });
    logDeep("smartAccountClient", smartAccountClient, {
      depth: 8,
      maxEntries: 500,
    });

    return smartAccountClient;
  } catch (error: any) {
    const smartAccountError = new SmartAccountError(
      `Failed to create smart account: ${error.message}`
    );
    smartAccountError.code = error.code || "SMART_ACCOUNT_CREATION_FAILED";
    smartAccountError.details = error;
    throw smartAccountError;
  }
};

export const getSmartAccountAddress = async (
  smartAccount: BiconomySmartAccountV2
): Promise<string> => {
  try {
    const address = await smartAccount.getAddress();
    return address;
  } catch (error: any) {
    const smartAccountError = new SmartAccountError(
      `Failed to get smart account address: ${error.message}`
    );
    smartAccountError.code = "ADDRESS_FETCH_FAILED";
    smartAccountError.details = error;
    throw smartAccountError;
  }
};

export const checkDeploymentStatus = async (
  smartAccount: BiconomySmartAccountV2
): Promise<boolean> => {
  try {
    return await smartAccount.isAccountDeployed();
  } catch (error: any) {
    const smartAccountError = new SmartAccountError(
      `Failed to check deployment status: ${error.message}`
    );
    smartAccountError.code = "DEPLOYMENT_CHECK_FAILED";
    smartAccountError.details = error;
    throw smartAccountError;
  }
};

export const deploySmartAccount = async (
  smartAccount: BiconomySmartAccountV2
) => {
  // 0) quick skip if already on-chain
  const already = await smartAccount.isAccountDeployed().catch(() => false);
  if (already) {
    console.log("[SA] already deployed");
    return "already-deployed";
  }

  // 1) sanity: what would be deployed?
  const saAddress = await smartAccount.getAddress();
  const initCode = await smartAccount.getInitCode?.().catch(() => undefined);
  console.log("[SA] counterfactual address:", saAddress);
  if (!initCode || initCode === "0x") {
    console.warn(
      "[SA] empty initCode — factory/config not set? deployment will likely fail."
    );
  }

  // 2) kick off deploy
  console.log("[SA] calling deploy()…");

  // viem public client for fees
  const publicClient = createPublicClient({
    chain: base,
    transport: http(
      `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`
    ),
  });

  // from your already-created smartAccountClient (BiconomySmartAccountV2):
  const sender = await smartAccount.getAccountAddress(); // counterfactual SA address

  // `callData` can be empty for pure deployment
  const callData = "0x";

  // nonce for key=0
  // (The bundler can also infer this; leaving zero is usually fine on first deploy,
  // but fetching it is more explicit.)
  const nonce = "0"; // as string; or read via EntryPoint.getNonce(sender, 0)

  // EIP-1559 caps as strings (Biconomy needs strings)
  const [maxFeePerGas, maxPriorityFeePerGas] = await (async () => {
    const fees = await publicClient.estimateFeesPerGas();
    console.log({ fees });
    // to string in wei
    return [
      ((fees.maxFeePerGas * 110n) / 100n)!.toString(),
      ((fees.maxPriorityFeePerGas * 110n) / 100n)!.toString(),
    ];
  })();

  // Deployment user operation
  const userOp: any = {
    sender, // SA address (counterfactual)
    nonce, // "0" for first op
    initCode, // non-empty => triggers deploy
    callData, // no-op
    callGasLimit: "0", // will be filled by estimate
    verificationGasLimit: "0", // will be filled by estimate
    preVerificationGas: "24000", // will be filled by estimate
    maxFeePerGas, // strings
    maxPriorityFeePerGas, // strings
    paymasterAndData: "0x", // maybe filled by sponsor step (below)
    signature: "0x", // will be replaced after signing
  };
  console.log({ userOp });
  // const paymasterUserOp = await smartAccount.getPaymasterUserOp(userOp, {
  //   mode: PaymasterMode.SPONSORED,
  // });
  // console.log({ paymasterUserOp });
  //
  // userOp = paymasterUserOp;

  const signed = await smartAccount.signUserOp(userOp);
  console.log({ signed });

  const res = await smartAccount.sendSignedUserOp(signed);
  console.log("userOpHash:", res.userOpHash);

  const { receipt, userOpHash } = await res.wait(); // includes transactionHash too
  console.log("txHash:", receipt?.transactionHash);
  console.log("userOpHash:", userOpHash);

  const { transactionHash } = await res.waitForTxHash();
  console.log({ transactionHash });

  // 4) final verification
  const nowDeployed = await smartAccount.isAccountDeployed().catch(() => false);
  if (!nowDeployed) {
    console.warn(
      "[SA] isAccountDeployed() still false after deploy. Indexing delay?"
    );
  }

  // return receipt.transactionHash as `0x${string}`;
  return transactionHash as `0x${string}`;
};

export const formatSmartAccountError = (error: any): string => {
  if (error instanceof SmartAccountError) {
    return error.message;
  }

  // Handle common error types
  if (error.message?.includes("insufficient funds")) {
    return "Insufficient funds for gas fees. Please add funds to your wallet.";
  }

  if (error.message?.includes("user rejected")) {
    return "Transaction was rejected by user.";
  }

  if (error.message?.includes("network")) {
    return "Network error. Please check your connection and try again.";
  }

  if (error.message?.includes("bundler")) {
    return "Bundler service unavailable. Please try again later.";
  }

  if (error.message?.includes("paymaster")) {
    return "Paymaster service unavailable. Transaction may require gas fees.";
  }

  // Fallback to generic error
  return error.message || "An unexpected error occurred. Please try again.";
};
