import { NextResponse } from "next/server";
import {
  createSessionRecord,
  pruneExpiredSessions,
  updateSessionRecord,
} from "../sessionStore";
import { DEGENSHOOT_CHAIN_ID } from "@/lib/contracts/addresses";
import { buildFairRows, calculateRowMultiplier } from "@/lib/games/bomb/fairness";
import {
  BOMBS_PER_ROW,
  HOUSE_EDGE,
  MAX_GENERATED_ROWS,
  MAX_ROWS,
  MAX_TILE_OPTION,
  MAX_TOTAL_MULTIPLIER,
  MIN_TILE_OPTION,
} from "@/components/apps/bomb/config";

type TileRange = { min: number; max: number };

function clampTile(value: number): number {
  return Math.min(Math.max(Math.floor(value), MIN_TILE_OPTION), MAX_TILE_OPTION);
}

function computeDynamicRowCount(range: TileRange): number {
  const worstRowMultiplier = calculateRowMultiplier(range.max, BOMBS_PER_ROW, HOUSE_EDGE);
  let dynamicRowCount = MAX_ROWS;
  if (worstRowMultiplier > 1.0001) {
    const estimated = Math.ceil(Math.log(MAX_TOTAL_MULTIPLIER) / Math.log(worstRowMultiplier));
    if (Number.isFinite(estimated) && estimated > dynamicRowCount) {
      dynamicRowCount = Math.min(MAX_GENERATED_ROWS, estimated + 5);
    }
  }
  return dynamicRowCount;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    pruneExpiredSessions();

    const requestedRange = body?.tileRange ?? {};
    const range: TileRange = {
      min: clampTile(requestedRange.min ?? MIN_TILE_OPTION),
      max: clampTile(requestedRange.max ?? MAX_TILE_OPTION),
    };
    if (range.max < range.min) range.max = range.min;

    if (typeof body?.address !== "string") {
      return NextResponse.json(
        { success: false, error: "ADDRESS_REQUIRED" },
        { status: 400 },
      );
    }

    const normalizedAddress = body.address.toLowerCase() as `0x${string}`;

    const lockedCountsInputRaw: number[] | null = Array.isArray(body?.lockedTileCounts)
      ? body.lockedTileCounts
          .map((value: unknown) => (typeof value === "number" ? clampTile(value) : null))
          .filter((value): value is number => value !== null)
      : null;
    const lockedCountsInput =
      lockedCountsInputRaw && lockedCountsInputRaw.length
        ? lockedCountsInputRaw.slice(0, MAX_GENERATED_ROWS)
        : null;

    const session = createSessionRecord({
      userAddress: normalizedAddress,
      wagerWei: body?.wagerWei,
      status: "pending",
      lockedTileCounts: lockedCountsInput ?? [],
    });

    const explicitTileCounts = lockedCountsInput && lockedCountsInput.length > 0 ? lockedCountsInput : undefined;
    const rowCount = Math.min(
      explicitTileCounts?.length ?? computeDynamicRowCount(range),
      MAX_GENERATED_ROWS,
    );

    const fairResult = await buildFairRows({
      serverSeed: session.serverSeed,
      clientSeed: session.clientSeed,
      rowCount,
      nonceBase: session.nonceBase,
      minTiles: range.min,
      maxTiles: range.max,
      bombsPerRow: BOMBS_PER_ROW,
      houseEdge: HOUSE_EDGE,
      maxTotalMultiplier: MAX_TOTAL_MULTIPLIER,
      explicitTileCounts,
    });

    const storedRows = fairResult.rows.map((meta) => ({
      ...meta,
      selectedColumn: null,
      crashed: false,
      isCompleted: false,
    }));

    updateSessionRecord(session.id, {
      status: "active",
      rows: storedRows,
      currentRow: 0,
      currentMultiplier: 1,
      completedRows: 0,
      lockedTileCounts: storedRows.map((row) => row.tileCount),
    });

    const layout = storedRows.map((row) => ({
      rowIndex: row.rowIndex,
      tileCount: row.tileCount,
      rowMultiplier: row.rowMultiplier,
      nonce: row.nonce,
      gameHash: row.gameHash,
      bombsPerRow: row.bombsPerRow,
      probabilities: row.probabilities,
      bombIndex: -1,
    }));

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      serverSeedHash: session.serverSeedHash,
      nonceBase: session.nonceBase,
      chainId: DEGENSHOOT_CHAIN_ID,
      rows: layout.map((row) => ({
        rowIndex: row.rowIndex,
        tileCount: row.tileCount,
        rowMultiplier: row.rowMultiplier,
        nonce: row.nonce,
        gameHash: row.gameHash,
        bombsPerRow: row.bombsPerRow,
      })),
      lockedTileCounts: storedRows.map((row) => row.tileCount),
    });
  } catch (error) {
    console.error("[API] /degenshoot/start failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "FAILED_TO_CREATE_SESSION",
      },
      { status: 500 },
    );
  }
}
