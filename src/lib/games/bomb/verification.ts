export interface VerificationResult {
  isValid: boolean;
  hashMatches: boolean;
  rowResults: RowVerificationResult[];
  error?: string;
}

export interface RowVerificationResult {
  rowIndex: number;
  nonce: number;
  expectedBombPosition: number;
  actualBombPosition: number;
  matches: boolean;
  fairHash: string;
}

/**
 * Verify game fairness by checking:
 * 1. Server seed hash matches SHA-256(server seed)
 * 2. Bomb positions match regenerated fair rows
 */
export async function verifyGameFairness(
  serverSeed: string,
  serverSeedHash: string,
  clientSeed: string,
  nonceBase: number,
  rowsData: Array<{
    rowIndex: number;
    bombPosition: number;
    tileCount: number;
  }>
): Promise<VerificationResult> {
  try {
    // Step 1: Verify hash
    const hashMatches = await verifyServerSeedHash(serverSeed, serverSeedHash);

    if (!hashMatches) {
      return {
        isValid: false,
        hashMatches: false,
        rowResults: [],
        error: 'Server seed hash does not match',
      };
    }

    // Step 2: Verify each row
    const rowResults: RowVerificationResult[] = [];

    for (const row of rowsData) {
      const nonce = nonceBase + row.rowIndex;
      const fairHash = await generateFairHash(serverSeed, clientSeed, nonce);
      const expectedBombPosition = calculateBombPosition(fairHash, row.tileCount);

      const matches = expectedBombPosition === row.bombPosition;

      rowResults.push({
        rowIndex: row.rowIndex,
        nonce,
        expectedBombPosition,
        actualBombPosition: row.bombPosition,
        matches,
        fairHash,
      });
    }

    // Overall validation
    const isValid = hashMatches && rowResults.every(r => r.matches);

    return {
      isValid,
      hashMatches,
      rowResults,
    };
  } catch (error) {
    return {
      isValid: false,
      hashMatches: false,
      rowResults: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify that SHA-256(serverSeed) === serverSeedHash
 */
export async function verifyServerSeedHash(
  serverSeed: string,
  serverSeedHash: string
): Promise<boolean> {
  // Use Web Crypto API (available in both browser and Node.js 16+)
  const encoder = new TextEncoder();
  const data = encoder.encode(serverSeed);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === serverSeedHash.toLowerCase();
}

/**
 * Generate fair hash for a row: SHA-256(serverSeed + clientSeed + nonce)
 */
export async function generateFairHash(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): Promise<string> {
  const combined = `${serverSeed}${clientSeed}${nonce}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate bomb position from fair hash
 */
export function calculateBombPosition(fairHash: string, tileCount: number): number {
  // Convert first 8 hex chars to integer
  const hashValue = parseInt(fairHash.substring(0, 8), 16);
  return hashValue % tileCount;
}

/**
 * Export seeds for external verification
 */
export function exportVerificationData(
  sessionId: string,
  serverSeed: string,
  clientSeed: string,
  serverSeedHash: string,
  nonceBase: number
): string {
  const data = {
    sessionId,
    serverSeed,
    clientSeed,
    serverSeedHash,
    nonceBase,
    timestamp: new Date().toISOString(),
  };

  return JSON.stringify(data, null, 2);
}
