// lib/defi/errors.ts - DeFi domain errors

/**
 * Base DeFi error
 */
export class DeFiError extends Error {
  constructor(
    message: string,
    public code: string,
    public phase?: string
  ) {
    super(message);
    this.name = "DeFiError";
  }
}

/**
 * DeFi normalization error
 */
export class DeFiNormalizationError extends DeFiError {
  constructor(message: string, code: string) {
    super(message, code, "normalize");
    this.name = "DeFiNormalizationError";
  }
}

/**
 * DeFi validation error
 */
export class DeFiValidationError extends DeFiError {
  constructor(message: string, code: string) {
    super(message, code, "validate");
    this.name = "DeFiValidationError";
  }
}

/**
 * DeFi execution error
 */
export class DeFiExecutionError extends DeFiError {
  constructor(message: string, code: string, public txHash?: string) {
    super(message, code, "execute");
    this.name = "DeFiExecutionError";
  }
}

/**
 * DeFi token selection error
 */
export class DeFiTokenSelectionError extends DeFiError {
  constructor(
    message: string,
    public tokens: Array<{
      id: number;
      chainId: number;
      address: string;
      symbol: string;
      name: string;
      decimals: number;
    }>,
    public tokenType?: "from" | "to" | "bridge"
  ) {
    super(message, "TOKEN_SELECTION_REQUIRED", "normalize");
    this.name = "DeFiTokenSelectionError";
  }
}

/**
 * DeFi route planning error
 */
export class DeFiRoutePlanningError extends DeFiError {
  constructor(message: string, code: string) {
    super(message, code, "plan");
    this.name = "DeFiRoutePlanningError";
  }
}
