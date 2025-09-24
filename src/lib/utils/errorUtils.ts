/**
 * Utility functions for comprehensive error handling
 */

export interface SafeAsyncResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    name?: string;
    stack?: string;
  };
}

/**
 * Safely executes an async function and returns a standardized result
 * Prevents unhandled promise rejections
 */
export async function safeAsync<T>(
  asyncFn: () => Promise<T>,
  context?: string
): Promise<SafeAsyncResult<T>> {
  try {
    const result = await asyncFn();
    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    const errorInfo = {
      message: error?.message || error?.toString() || "Unknown error occurred",
      code: error?.code,
      name: error?.name,
      stack: error?.stack,
    };

    if (context) {
      console.error(`Error in ${context}:`, errorInfo);
    } else {
      console.error("Safe async error:", errorInfo);
    }

    return {
      success: false,
      error: errorInfo,
    };
  }
}

/**
 * Creates a standardized error message for user display
 */
export function formatUserError(error: any, fallback = "An unexpected error occurred"): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error?.message) {
    return error.message;
  }

  if (error?.toString && typeof error.toString === 'function') {
    try {
      return error.toString();
    } catch {
      return fallback;
    }
  }

  return fallback;
}

/**
 * Global error handler for unhandled promise rejections
 */
export function setupGlobalErrorHandlers() {
  if (typeof window !== 'undefined') {
    // Browser environment
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);

      // Optional: Send to monitoring service
      // sendErrorToService(event.reason, 'unhandled_promise_rejection');

      // Prevent the default browser behavior (logging to console)
      event.preventDefault();
    });

    window.addEventListener('error', (event) => {
      console.error('Uncaught error:', event.error);

      // Optional: Send to monitoring service
      // sendErrorToService(event.error, 'uncaught_error');
    });
  }

  if (typeof process !== 'undefined') {
    // Node.js environment
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);

      // Optional: Send to monitoring service
      // sendErrorToService(reason, 'unhandled_rejection');
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);

      // Optional: Send to monitoring service
      // sendErrorToService(error, 'uncaught_exception');

      // Graceful shutdown
      process.exit(1);
    });
  }
}

/**
 * Wraps a function to catch and handle errors gracefully
 */
export function withErrorHandling<T extends (...args: any[]) => any>(
  fn: T,
  context?: string
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);

      // Handle async functions
      if (result && typeof result.then === 'function') {
        return result.catch((error: any) => {
          console.error(`Error in ${context || fn.name}:`, error);
          throw error;
        });
      }

      return result;
    } catch (error) {
      console.error(`Error in ${context || fn.name}:`, error);
      throw error;
    }
  }) as T;
}

/**
 * Error codes used throughout the application
 */
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  USER_REJECTED: 'USER_REJECTED',
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];