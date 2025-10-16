'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * OnboardingErrorBoundary
 *
 * Catches errors in the onboarding system and displays a user-friendly error message.
 * Allows users to continue using the app even if onboarding fails.
 */
export class OnboardingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[OnboardingErrorBoundary] Error caught:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // TODO: Log to error tracking service (e.g., Sentry)
    // Example: Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
  }

  handleDismiss = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleContinue = () => {
    // Clear error and allow app to continue
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Clear onboarding from localStorage to prevent repeated errors
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('deviceId');
        localStorage.removeItem('deviceFingerprint');
      } catch (e) {
        console.error('[OnboardingErrorBoundary] Failed to clear localStorage:', e);
      }
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/95 backdrop-blur-md px-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-red-500/30 bg-gradient-to-br from-slate-900 to-slate-950 p-8 shadow-2xl shadow-red-500/20">
            {/* Close button */}
            <button
              type="button"
              onClick={this.handleDismiss}
              className="absolute right-4 top-4 rounded-full border border-slate-700 bg-slate-900/70 p-2 text-slate-400 transition-all hover:border-red-400/40 hover:text-red-200"
              aria-label="Close"
            >
              <FiX className="h-4 w-4" />
            </button>

            {/* Icon */}
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-red-500/10 p-4 border border-red-500/20">
                <FiAlertTriangle className="h-12 w-12 text-red-400" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-white mb-3 text-center">
              Onboarding Error
            </h2>

            {/* Message */}
            <p className="text-sm text-slate-300 leading-relaxed mb-6 text-center">
              We encountered an issue with the onboarding flow. Don&apos;t worry - you can still
              use ExecFi without any problems.
            </p>

            {/* Error details (development mode only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 rounded-lg bg-slate-900/50 border border-slate-700">
                <p className="text-xs font-mono text-red-400 mb-2">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
                      Stack trace
                    </summary>
                    <pre className="mt-2 text-[10px] text-slate-500 overflow-x-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={this.handleContinue}
                className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold text-sm shadow-lg shadow-emerald-500/30 transition-all hover:shadow-emerald-500/50 hover:scale-105"
              >
                Continue to ExecFi
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full px-6 py-3 rounded-lg border border-slate-600 text-slate-300 font-medium text-sm transition-all hover:border-slate-500 hover:text-white"
              >
                Reload Page
              </button>
            </div>

            {/* Help text */}
            <p className="mt-6 text-xs text-slate-500 text-center">
              If this issue persists, please contact support or try clearing your browser cache.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
