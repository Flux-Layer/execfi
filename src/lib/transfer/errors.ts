// lib/transfer/errors.ts - Transfer domain errors

/**
 * Base transfer error
 */
export class TransferError extends Error {
  constructor(
    message: string,
    public code: string,
    public phase?: string
  ) {
    super(message);
    this.name = "TransferError";
  }
}

/**
 * Transfer normalization error
 */
export class TransferNormalizationError extends TransferError {
  constructor(message: string, code: string) {
    super(message, code, "normalize");
    this.name = "TransferNormalizationError";
  }
}

/**
 * Transfer validation error
 */
export class TransferValidationError extends TransferError {
  constructor(message: string, code: string) {
    super(message, code, "validate");
    this.name = "TransferValidationError";
  }
}

/**
 * Transfer execution error
 */
export class TransferExecutionError extends TransferError {
  constructor(message: string, code: string, public txHash?: string) {
    super(message, code, "execute");
    this.name = "TransferExecutionError";
  }
}

/**
 * Transfer token selection error
 */
export class TransferTokenSelectionError extends TransferError {
  constructor(
    message: string,
    public tokens: Array<{
      id: number;
      chainId: number;
      address: string;
      symbol: string;
      name: string;
      decimals: number;
      logoURI?: string;
      verified?: boolean;
    }>
  ) {
    super(message, "TOKEN_SELECTION_REQUIRED", "normalize");
    this.name = "TransferTokenSelectionError";
  }
}
