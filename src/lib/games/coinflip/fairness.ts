import crypto from "crypto";
import { type CoinFlipSide, normalizeCoinSide } from "./config";

export type CoinFlipOutcome = {
  outcome: CoinFlipSide;
  randomValue: number;
  hash: string;
};

export function generateServerSeed(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function generateClientSeed(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function hashSeed(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

export function deriveOutcome(
  serverSeed: string,
  clientSeed: string,
  nonce = 0,
): CoinFlipOutcome {
  const payload = `${serverSeed}:${clientSeed}:${nonce}`;
  const hashBuffer = crypto.createHash("sha256").update(payload).digest();
  const hashHex = hashBuffer.toString("hex");
  // Use first 4 bytes to keep numbers in JS safe integer range for parity check
  const randomValue = hashBuffer.readUInt32BE(0);
  const outcome = randomValue % 2 === 0 ? "Heads" : "Tails";

  return {
    outcome,
    randomValue,
    hash: hashHex,
  };
}

export function mapOutcomeToEnum(value: CoinFlipSide | string): 0 | 1 {
  const normalized = normalizeCoinSide(value);
  if (normalized === "Heads") return 0;
  if (normalized === "Tails") return 1;
  throw new Error(`Invalid coin side: ${value}`);
}
