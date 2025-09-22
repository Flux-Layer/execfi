import { BiconomySmartAccountV2 } from "@biconomy/account";
import { ConnectedWallet } from "@privy-io/react-auth";

export interface SmartAccountConfig {
  chainId: number;
  bundlerUrl: string;
  paymasterApiKey?: string;
}

export interface TransactionData {
  to: string;
  value?: string | number | bigint;
  data?: string;
}

export interface SmartAccountContextType {
  // Smart Account Instance
  smartAccount: BiconomySmartAccountV2 | null;
  smartAccountAddress: string | null;

  // Deployment Status
  isDeployed: boolean;
  isDeploying: boolean;
  deploy: () => Promise<void>;

  // Transaction Methods
  sendTransaction: (txData: TransactionData) => Promise<string>;
  sendBatchTransaction: (txDataArray: TransactionData[]) => Promise<string>;

  // State Management
  isLoading: boolean;
  error: string | null;

  // Configuration
  currentChainId: number;
  switchChain: (chainId: number) => Promise<void>;

  // Paymaster
  isPaymasterEnabled: boolean;
  enablePaymaster: () => void;
  disablePaymaster: () => void;
}

export class SmartAccountError extends Error {
  code?: string;
  details?: any;

  constructor(message: string, code?: string, details?: any) {
    super(message);
    this.name = 'SmartAccountError';
    this.code = code;
    this.details = details;
  }
}

export interface DeploymentStatus {
  isDeployed: boolean;
  deploymentTxHash?: string;
  deploymentBlockNumber?: number;
}

export interface TransactionResult {
  txHash: string;
  receipt?: any;
  userOpHash?: string;
}