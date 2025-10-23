/**
 * Provably fair engine helpers for the Bomb mini-game.
 *
 * This module exposes utilities for generating server/client seeds,
 * hashing with SHA-256 via WebCrypto, deriving deterministic outcomes,
 * and verifying results for audit purposes.
 */

const WEB_CRYPTO = typeof crypto !== "undefined" ? crypto : undefined;
const TEXT_ENCODER = typeof TextEncoder !== "undefined" ? new TextEncoder() : undefined;

if (!WEB_CRYPTO || !WEB_CRYPTO.getRandomValues || !WEB_CRYPTO.subtle) {
   console.warn("[Bomb Fairness] Web Crypto API unavailable. Provably fair features disabled.");
}

export type FairnessSeeds = {
   serverSeed: string;
   serverSeedHash: string;
   clientSeed: string;
};

export type RowFairnessMeta = {
   rowIndex: number;
   nonce: number;
   gameHash: string;
   tileCount: number;
   bombIndex: number;
   rowMultiplier: number;
   bombsPerRow: number;
   probabilities: Array<{ tileIndex: number; bomb: number; safe: number }>;
};

export type RowCfg = {
   N: number;
   B: number;
};

export type BuildRowsParams = {
  serverSeed: string;
  clientSeed: string;
  rowCount: number;
  nonceBase?: number;
  tilePreference?: number | null;
  minTiles: number;
  maxTiles: number;
  bombsPerRow?: number;
  houseEdge?: number;
  maxTotalMultiplier?: number;
  explicitTileCounts?: number[] | null;
};

export type BuildRowsResult = {
   rows: RowFairnessMeta[];
};

export async function sha256Hex(input: string): Promise<string> {
   if (!WEB_CRYPTO || !WEB_CRYPTO.subtle || !TEXT_ENCODER) {
      throw new Error("Web Crypto API not available");
   }
   const data = TEXT_ENCODER.encode(input);
   const hashBuffer = await WEB_CRYPTO.subtle.digest("SHA-256", data);
   const hashArray = Array.from(new Uint8Array(hashBuffer));
   return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomHex(bytes = 32): string {
   if (!WEB_CRYPTO || !WEB_CRYPTO.getRandomValues) {
      throw new Error("Web Crypto API not available");
   }
   const array = new Uint8Array(bytes);
   WEB_CRYPTO.getRandomValues(array);
   return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hashToUint32Array(hash: string): number[] {
   const values: number[] = [];
   for (let i = 0; i + 8 <= hash.length; i += 8) {
      const slice = hash.slice(i, i + 8);
      values.push(parseInt(slice, 16) >>> 0);
   }
   if (values.length === 0) {
      values.push(parseInt(hash, 16) >>> 0);
   }
   return values;
}

async function deriveGameHash(serverSeed: string, clientSeed: string, nonce: number, salt = ""): Promise<string> {
   return sha256Hex(`${serverSeed}:${clientSeed}:${nonce}:${salt}`);
}

export function calculateRowMultiplier(
   tileCount: number,
   bombsPerRow = 1,
   houseEdge = 0,
): number {
   const totalTiles = Math.max(0, Math.floor(tileCount));
   const bombs = Math.max(0, Math.floor(bombsPerRow));
   if (totalTiles < 2 || bombs >= totalTiles) {
      return 0;
   }
   const base = totalTiles / (totalTiles - bombs);
   const edge = Math.max(0, Math.min(0.99, Number.isFinite(houseEdge) ? houseEdge : 0));
   const multiplier = base * (1 - edge);
   if (!Number.isFinite(multiplier) || multiplier <= 0) {
      return 0;
   }
   return multiplier;
}

export function cumulativeUntilDecimal(
   rows: RowCfg[],
   r: number,
   e = 0,
): number {
   const limit = Math.max(0, Math.min(r, rows.length));
   let total = 1;
   for (let i = 0; i < limit; i++) {
      const row = rows[i];
      const rowMult = calculateRowMultiplier(row.N, row.B, e);
      total *= rowMult;
   }
   return total;
}

export function cumulativeUntil(
   rows: RowCfg[],
   r: number,
   e = 0,
): number {
   return cumulativeUntilDecimal(rows, r, e);
}

export type LiveTotal = {
   carryIn: number;
   rowPreview: number;
   totalPreview: number;
};

export function liveTotal(
   rowsDone: RowCfg[],
   current: { N: number; B: number },
   kPreview: number,
   e = 0,
): LiveTotal {
   const carryIn = cumulativeUntilDecimal(rowsDone, rowsDone.length, e);
   const rowPreview = calculateRowMultiplier(current.N, current.B, e);
   return {
      carryIn,
      rowPreview,
      totalPreview: carryIn * rowPreview,
   };
}

export async function buildFairRows({
  serverSeed,
  clientSeed,
  rowCount,
  nonceBase = 0,
  tilePreference = null,
  minTiles,
  maxTiles,
  bombsPerRow = 1,
  houseEdge = 0,
  maxTotalMultiplier,
  explicitTileCounts = null,
}: BuildRowsParams): Promise<BuildRowsResult> {
  const rows: RowFairnessMeta[] = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const nonce = nonceBase + rowIndex;
    const primaryHash = await deriveGameHash(serverSeed, clientSeed, nonce);
    const numbers = hashToUint32Array(primaryHash);

    const explicit = explicitTileCounts?.[rowIndex];
    let tileCount =
       explicit && Number.isFinite(explicit)
          ? Math.max(2, Math.min(maxTiles, Math.max(minTiles, Math.floor(explicit))))
          : tilePreference !== null
          ? tilePreference
          : minTiles + (numbers[0] % Math.max(1, maxTiles - minTiles + 1));

    const availableTiles = Array.from({ length: tileCount }, (_, idx) => idx);
    const bombIndices: number[] = [];
    let numberPointer = 1;

      for (let bomb = 0; bomb < Math.min(bombsPerRow, tileCount); bomb++) {
         if (numberPointer >= numbers.length) {
            const extraHash = await deriveGameHash(serverSeed, clientSeed, nonce, `extra-${bomb}-${numberPointer}`);
            numbers.push(...hashToUint32Array(extraHash));
         }

         const randomPick = numbers[numberPointer] % availableTiles.length;
         bombIndices.push(availableTiles[randomPick]);
         availableTiles.splice(randomPick, 1);
         numberPointer++;
      }

      const probabilities = Array.from({ length: tileCount }, (_, tileIndex) => ({
         tileIndex,
         bomb: bombsPerRow / tileCount,
         safe: 1 - bombsPerRow / tileCount,
      }));

      // For the current UI we expect exactly one bomb per row; take the first index.
      const bombIndex = bombIndices[0] ?? 0;
      const rowMultiplier = calculateRowMultiplier(tileCount, bombsPerRow, houseEdge);

      if (maxTotalMultiplier && rowMultiplier > maxTotalMultiplier) {
         break;
      }

      rows.push({
         rowIndex,
         nonce,
         gameHash: primaryHash,
         tileCount,
         bombIndex,
         rowMultiplier,
         bombsPerRow,
         probabilities,
      });
   }

   return { rows };
}

export async function generateSeeds(defaultClientSeed?: string): Promise<FairnessSeeds> {
   const serverSeed = randomHex(32);
   const serverSeedHash = await sha256Hex(serverSeed);
   const clientSeed = defaultClientSeed ?? randomHex(16);
   return { serverSeed, serverSeedHash, clientSeed };
}

export type VerifyRowParams = {
   serverSeed: string;
   serverSeedHash: string;
   clientSeed: string;
   nonce: number;
   tileCount: number;
   expectedBombIndex: number;
   bombsPerRow?: number;
};

export type VerifyRowResult = {
   valid: boolean;
   recomputedHash: string;
   recomputedBombIndex: number;
   recomputedTileCount: number;
};

export async function verifyRow({
   serverSeed,
   serverSeedHash,
   clientSeed,
   nonce,
   tileCount,
   expectedBombIndex,
   bombsPerRow = 1,
}: VerifyRowParams): Promise<VerifyRowResult> {
   const recomputedHash = await deriveGameHash(serverSeed, clientSeed, nonce);
   const recomputedServerHash = await sha256Hex(serverSeed);

   if (recomputedServerHash !== serverSeedHash) {
      return {
         valid: false,
         recomputedHash,
         recomputedBombIndex: -1,
         recomputedTileCount: tileCount,
      };
   }

   const numbers = hashToUint32Array(recomputedHash);
   const availableTiles = Array.from({ length: tileCount }, (_, idx) => idx);
   let numberPointer = 1;
   let recomputedBombIndex = -1;

   for (let bomb = 0; bomb < Math.min(bombsPerRow, tileCount); bomb++) {
      if (numberPointer >= numbers.length) {
         const extraHash = await deriveGameHash(serverSeed, clientSeed, nonce, `extra-${bomb}-${numberPointer}`);
         numbers.push(...hashToUint32Array(extraHash));
      }
      const pick = numbers[numberPointer] % availableTiles.length;
      recomputedBombIndex = availableTiles[pick];
      availableTiles.splice(pick, 1);
      numberPointer++;
   }

   return {
      valid: recomputedBombIndex === expectedBombIndex,
      recomputedHash,
      recomputedBombIndex,
      recomputedTileCount: tileCount,
   };
}
