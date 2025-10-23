'use client';

import { useState, useEffect } from 'react';
import { verifyRow, sha256Hex } from '@/lib/games/bomb/fairness';
import { exportVerificationData } from '@/lib/games/bomb/verification';

interface VerificationResult {
  isValid: boolean;
  hashMatches: boolean;
  rowResults: RowVerificationResult[];
  error?: string;
}

interface RowVerificationResult {
  rowIndex: number;
  nonce: number;
  expectedBombPosition: number;
  actualBombPosition: number;
  matches: boolean;
  fairHash: string;
}

interface BombVerificationModalProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  currentUserAddress?: `0x${string}` | null;
}

export function BombVerificationModal({
  sessionId,
  isOpen,
  onClose,
  onVerified,
  currentUserAddress,
}: BombVerificationModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    if (isOpen && sessionId) {
      loadAndVerify();
    }
  }, [isOpen, sessionId]);

  const loadAndVerify = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch session data
      const response = await fetch(`/api/degenshoot/session/${sessionId}`);
      if (!response.ok) {
        throw new Error('Failed to load session data');
      }

      const data = await response.json();
      setSessionData(data);

      // Perform verification using the correct algorithm from fairness.ts
      // Step 1: Verify server seed hash
      const computedServerSeedHash = await sha256Hex(data.serverSeed);
      const hashMatches = computedServerSeedHash === data.serverSeedHash.toLowerCase();

      // Step 2: Verify each row using the same Fisher-Yates algorithm as game generation
      const rowResults: RowVerificationResult[] = [];

      for (const row of data.rows as any[]) {
        const nonce = data.nonceBase + row.rowIndex;

        // Use the correct verifyRow function that matches game generation
        const verifyResult = await verifyRow({
          serverSeed: data.serverSeed,
          serverSeedHash: data.serverSeedHash,
          clientSeed: data.clientSeed,
          nonce,
          tileCount: row.tileCount,
          expectedBombIndex: row.bombIndex,
          bombsPerRow: 1,
        });

        rowResults.push({
          rowIndex: row.rowIndex,
          nonce,
          expectedBombPosition: verifyResult.recomputedBombIndex,
          actualBombPosition: row.bombIndex,
          matches: verifyResult.valid,
          fairHash: verifyResult.recomputedHash,
        });
      }

      // Overall validation
      const isValid = hashMatches && rowResults.every(r => r.matches);

      const result: VerificationResult = {
        isValid,
        hashMatches,
        rowResults,
      };

      setVerificationResult(result);

      // Mark as verified if successful
      if (result.isValid) {
        const addressToVerify = (currentUserAddress ?? data.userAddress ?? '').toLowerCase();
        if (!addressToVerify) {
          throw new Error('Wallet address is required to mark this session as verified.');
        }

        await fetch('/api/degenshoot/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            userAddress: addressToVerify,
            verifiedHash: data.serverSeedHash,
          }),
        });
        window.dispatchEvent(new CustomEvent('degenshoot-history-verified'));
        // Don't auto-close modal - let user close it manually
        // onVerified();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySeeds = () => {
    if (!sessionData) return;

    const exportData = exportVerificationData(
      sessionId,
      sessionData.serverSeed,
      sessionData.clientSeed,
      sessionData.serverSeedHash,
      sessionData.nonceBase
    );

    navigator.clipboard.writeText(exportData);
    alert('Verification data copied to clipboard!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-4xl rounded-lg border border-gray-700 bg-gray-900 shadow-xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 p-3 sm:p-4 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-100">Verify Game Fairness</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200"
            aria-label="Close"
          >
            <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto p-3 sm:p-4 flex-1 min-h-0">
          {isLoading && <LoadingState />}
          {error && <ErrorState error={error} onRetry={loadAndVerify} />}
          {verificationResult && sessionData && (
            <VerificationContent
              sessionData={sessionData}
              result={verificationResult}
              onCopySeeds={handleCopySeeds}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-3 sm:p-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full rounded bg-gray-700 px-4 py-2 text-sm sm:text-base text-white hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Loading State
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-green-500" />
      <p className="mt-4 text-gray-400">Verifying game fairness...</p>
    </div>
  );
}

// Error State
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-red-400">
      <p className="text-lg">Verification Failed</p>
      <p className="mt-2 text-sm">{error}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600"
      >
        Retry
      </button>
    </div>
  );
}

// Verification Content
function VerificationContent({
  sessionData,
  result,
  onCopySeeds,
}: {
  sessionData: any;
  result: VerificationResult;
  onCopySeeds: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Overall Result */}
      <div
        className={`rounded-lg border-2 p-4 ${
          result.isValid
            ? 'border-green-500 bg-green-900/20'
            : 'border-red-500 bg-red-900/20'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl">{result.isValid ? '✅' : '❌'}</span>
          <div>
            <p className={`text-lg font-bold ${result.isValid ? 'text-green-400' : 'text-red-400'}`}>
              {result.isValid ? 'Game is Provably Fair' : 'Verification Failed'}
            </p>
            <p className="text-sm text-gray-400">
              {result.isValid
                ? 'All checks passed. This game was fair.'
                : 'One or more checks failed. Please review details below.'}
            </p>
          </div>
        </div>
      </div>

      {/* Seeds Section */}
      <section>
        <h3 className="mb-3 text-lg font-semibold text-gray-200">Seeds</h3>
        <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-800 p-4">
          <SeedDisplay label="Server Seed Hash" value={sessionData.serverSeedHash} />
          <SeedDisplay label="Server Seed (Revealed)" value={sessionData.serverSeed} />
          <SeedDisplay label="Client Seed" value={sessionData.clientSeed} />
          <div>
            <p className="text-sm text-gray-400">Nonce Base</p>
            <p className="mt-1 font-mono text-sm text-gray-200">{sessionData.nonceBase}</p>
          </div>
        </div>
        <button
          onClick={onCopySeeds}
          className="mt-2 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Copy Verification Data
        </button>
      </section>

      {/* Hash Verification */}
      <section>
        <h3 className="mb-3 text-lg font-semibold text-gray-200">Hash Verification</h3>
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{result.hashMatches ? '✅' : '❌'}</span>
            <div className="flex-1">
              <p className={`font-medium ${result.hashMatches ? 'text-green-400' : 'text-red-400'}`}>
                {result.hashMatches
                  ? 'Hash verification passed'
                  : 'Hash verification failed'}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                SHA-256({sessionData.serverSeed.substring(0, 20)}...) = {sessionData.serverSeedHash.substring(0, 20)}...
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Row Results */}
      <section>
        <h3 className="mb-3 text-lg font-semibold text-gray-200">
          Row-by-Row Verification ({result.rowResults.length} rows)
        </h3>
        <div className="space-y-2">
          {result.rowResults.map(row => (
            <RowVerificationCard key={row.rowIndex} row={row} rowData={sessionData.rows[row.rowIndex]} />
          ))}
        </div>
      </section>
    </div>
  );
}

// Seed Display Component
function SeedDisplay({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <p className="text-sm text-gray-400">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="flex-1 truncate font-mono text-sm text-gray-200">{value}</p>
        <button
          onClick={handleCopy}
          className="rounded bg-gray-700 px-2 py-1 text-xs text-white hover:bg-gray-600"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

// Row Verification Card
function RowVerificationCard({ row, rowData }: { row: RowVerificationResult; rowData: any }) {
  const tileCount = rowData?.tileCount || 0;
  const bombPosition = row.expectedBombPosition;
  const selectedColumn = rowData?.selectedColumn;

  return (
    <div
      className={`rounded-lg border p-3 ${
        row.matches
          ? 'border-green-700 bg-green-900/10'
          : 'border-red-700 bg-red-900/10'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">{row.matches ? '✅' : '❌'}</span>
          <div>
            <p className="font-medium text-gray-200">Row {row.rowIndex + 1}</p>
            <p className="text-xs text-gray-400">Nonce: {row.nonce}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-300">
            Bomb Position: {row.expectedBombPosition}
          </p>
          {!row.matches && (
            <p className="text-xs text-red-400">
              Expected: {row.expectedBombPosition}, Got: {row.actualBombPosition}
            </p>
          )}
        </div>
      </div>

      {/* Visual Tile Representation */}
      <div className="mt-2 sm:mt-3 rounded-lg border border-gray-700 bg-gray-800/50 p-2 sm:p-3">
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          {Array.from({ length: tileCount }).map((_, idx) => {
            const isBomb = idx === bombPosition;
            const isSelected = idx === selectedColumn;

            return (
              <div
                key={idx}
                className={`
                  relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-md sm:rounded-lg border transition
                  ${isBomb
                    ? 'border-red-500/80 bg-red-900/30 ring-1 sm:ring-2 ring-red-500/50'
                    : 'border-gray-600 bg-gray-700/50'
                  }
                  ${isSelected && !isBomb ? 'border-green-500/80 bg-green-900/30 ring-1 sm:ring-2 ring-green-500/50' : ''}
                  ${isSelected && isBomb ? 'border-red-500 bg-red-900/50 ring-1 sm:ring-2 ring-red-500' : ''}
                `}
              >
                {isBomb && (
                  <span className="text-xl sm:text-2xl">💣</span>
                )}
                {isSelected && !isBomb && (
                  <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-green-400"></div>
                )}
                {/* Tile number label */}
                <span className="absolute -bottom-3.5 sm:-bottom-4 text-[9px] sm:text-[10px] text-gray-500">{idx}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 sm:mt-5 text-center text-[10px] sm:text-xs text-gray-400">
          {tileCount} tiles · {selectedColumn !== null && selectedColumn !== undefined ? `Selected: ${selectedColumn}` : 'No selection'}
        </div>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-400">
          Show hash details
        </summary>
        <p className="mt-2 truncate font-mono text-xs text-gray-500">{row.fairHash}</p>
      </details>
    </div>
  );
}
