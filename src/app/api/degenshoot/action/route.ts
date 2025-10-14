import { NextResponse } from "next/server";
import {
  keccak256,
  encodeAbiParameters,
  parseEventLogs,
  type Hex,
} from "viem";
import {
  getSessionRecord,
  updateSessionRecord,
} from "../sessionStore";
import {
  DEGENSHOOT_CHAIN_ID,
  DEGENSHOOT_GAME_ID,
  WAGER_VAULT_ADDRESS,
} from "@/lib/contracts/addresses";
import {
  WAGER_VAULT_ABI,
  wagerVaultPublicClient,
} from "@/lib/contracts/wagerVault";

function normalizeAddress(address?: string | null): string | null {
  if (!address || typeof address !== "string") return null;
  try {
    return address.toLowerCase();
  } catch {
    return null;
  }
}

function buildSummary(completedRows: number, multiplier: number) {
  const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  const xp = Math.max(10, completedRows * 100);
  const kills = completedRows;
  const timeAlive = Math.max(1, completedRows * 30);
  const score = Math.max(1, Math.round(safeMultiplier * 1000));
  return {
    xp,
    kills,
    timeAlive,
    score,
    multiplier: safeMultiplier,
    completedRows,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;
    const action = typeof body?.action === "string" ? body.action : null;
    const requester = normalizeAddress(body?.address);

    if (!sessionId || !action) {
      return NextResponse.json({ success: false, error: "INVALID_REQUEST" }, { status: 400 });
    }

    const session = getSessionRecord(sessionId);
    if (!session) {
      return NextResponse.json({ success: false, error: "SESSION_NOT_FOUND" }, { status: 404 });
    }

    if (!requester) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 403 });
    }

    if (session.userAddress && session.userAddress.toLowerCase() !== requester) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 403 });
    }

    if (session.status === "submitted") {
      return NextResponse.json({ success: false, error: "SESSION_ALREADY_SUBMITTED" }, { status: 409 });
    }

    if (!session.rows.length) {
      return NextResponse.json({ success: false, error: "SESSION_NOT_INITIALISED" }, { status: 409 });
    }

    if (!session.userAddress) {
      return NextResponse.json({ success: false, error: "SESSION_UNBOUND" }, { status: 409 });
    }

    if (action === "selectTile") {
      if (session.status !== "active") {
        return NextResponse.json({ success: false, error: "SESSION_NOT_ACTIVE" }, { status: 409 });
      }

      const column = Number(body?.column);
      if (!Number.isInteger(column) || column < 0) {
        return NextResponse.json({ success: false, error: "INVALID_COLUMN" }, { status: 400 });
      }

      const currentRowIndex = session.currentRow;
      if (currentRowIndex < 0 || currentRowIndex >= session.rows.length) {
        return NextResponse.json({ success: false, error: "ROUND_FINISHED" }, { status: 409 });
      }

      const currentRow = session.rows[currentRowIndex];
      if (currentRow.selectedColumn !== null || currentRow.crashed) {
        return NextResponse.json({ success: false, error: "ROW_ALREADY_REVEALED" }, { status: 409 });
      }

      if (column >= currentRow.tileCount) {
        return NextResponse.json({ success: false, error: "INVALID_COLUMN" }, { status: 400 });
      }

      const hitBomb = column === currentRow.bombIndex;
      const updatedRows = session.rows.map((row, idx) =>
        idx === currentRowIndex
          ? {
              ...row,
              selectedColumn: column,
              crashed: hitBomb,
              isCompleted: !hitBomb,
            }
          : row,
      );

      if (hitBomb) {
        const summary = buildSummary(session.completedRows, session.currentMultiplier);
        updateSessionRecord(session.id, {
          rows: updatedRows,
          status: "lost",
          currentRow: currentRowIndex,
          roundSummary: summary,
          finalizedAt: Date.now(),
        });

        return NextResponse.json({
          success: true,
          sessionId,
          result: "bomb",
          rowIndex: currentRowIndex,
          bombColumn: currentRow.bombIndex,
          status: "lost",
          currentMultiplier: session.currentMultiplier,
          completedRows: session.completedRows,
          summary,
          chainId: DEGENSHOOT_CHAIN_ID,
        });
      }

      const newCompletedRows = session.completedRows + 1;
      const newMultiplier = session.currentMultiplier * currentRow.rowMultiplier;
      const summary = buildSummary(newCompletedRows, newMultiplier);
      const nextRowIndex = currentRowIndex + 1;
      const hasMoreRows = nextRowIndex < updatedRows.length;
      const nextStatus = hasMoreRows ? "active" : "completed";
      const finalizedAt = hasMoreRows ? null : Date.now();

      updateSessionRecord(session.id, {
        rows: updatedRows,
        currentRow: hasMoreRows ? nextRowIndex : session.rows.length,
        currentMultiplier: newMultiplier,
        completedRows: newCompletedRows,
        status: nextStatus,
        roundSummary: summary,
        finalizedAt,
      });

      return NextResponse.json({
        success: true,
        sessionId,
        result: "safe",
        rowIndex: currentRowIndex,
        selectedColumn: column,
        nextRowIndex: hasMoreRows ? nextRowIndex : -1,
        status: nextStatus,
        currentMultiplier: newMultiplier,
        completedRows: newCompletedRows,
        summary,
        chainId: DEGENSHOOT_CHAIN_ID,
      });
    }

    if (action === "registerWager") {
      const wagerWeiInput = typeof body?.wagerWei === "string" ? body.wagerWei : null;
      if (!wagerWeiInput) {
        return NextResponse.json({ success: false, error: "INVALID_WAGER" }, { status: 400 });
      }

      let normalizedWager: string;
      let wagerValue: bigint;
      try {
        const value = BigInt(wagerWeiInput);
        if (value <= 0n) throw new Error("Wager must be positive");
        normalizedWager = value.toString();
        wagerValue = value;
      } catch {
        return NextResponse.json({ success: false, error: "INVALID_WAGER" }, { status: 400 });
      }

      if (session.wagerWei) {
        if (session.wagerWei === normalizedWager) {
          return NextResponse.json({
            success: true,
            sessionId,
            wagerWei: normalizedWager,
            chainId: DEGENSHOOT_CHAIN_ID,
          });
        }
        return NextResponse.json(
          { success: false, error: "WAGER_ALREADY_REGISTERED" },
          { status: 409 },
        );
      }

      if (!WAGER_VAULT_ADDRESS) {
        return NextResponse.json(
          { success: false, error: "ONCHAIN_UNAVAILABLE" },
          { status: 503 },
        );
      }

      try {
        let sessionNumericId: bigint;
        try {
          sessionNumericId = BigInt(session.id);
        } catch {
          return NextResponse.json(
            { success: false, error: "INVALID_SESSION_ID" },
            { status: 500 },
          );
        }

        const sessionKey = keccak256(
          encodeAbiParameters(
            [
              { type: "address" },
              { type: "uint256" },
              { type: "uint64" },
            ],
            [
              session.userAddress as `0x${string}`,
              BigInt(DEGENSHOOT_GAME_ID),
              sessionNumericId,
            ],
          ),
        );

        const escrowAmount = await wagerVaultPublicClient.readContract({
          address: WAGER_VAULT_ADDRESS,
          abi: WAGER_VAULT_ABI,
          functionName: "escrow",
          args: [sessionKey],
        });

        if (escrowAmount === 0n || escrowAmount !== wagerValue) {
          const txHashInput =
            typeof body?.txHash === "string" && body.txHash.startsWith("0x")
              ? (body.txHash as Hex)
              : null;

          if (!txHashInput) {
            return NextResponse.json(
              { success: false, error: "WAGER_NOT_FOUND_ONCHAIN" },
              { status: 409 },
            );
          }

          const receipt = await wagerVaultPublicClient.waitForTransactionReceipt({
            hash: txHashInput,
            timeout: 30_000,
            pollingInterval: 1_500,
          });

          if (receipt.status !== "success") {
            return NextResponse.json(
              { success: false, error: "WAGER_VERIFICATION_FAILED" },
              { status: 502 },
            );
          }

        type BetPlacedLog = {
          eventName: "BetPlaced";
          args: {
            bettor: `0x${string}`;
            sessionKey: `0x${string}`;
            amount: bigint;
          };
        };

        const logs = parseEventLogs({
          abi: WAGER_VAULT_ABI,
          eventName: "BetPlaced",
          logs: receipt.logs,
        }) as unknown as BetPlacedLog[];

        const matchedLog = logs.find((log) => {
          const bettor = log.args.bettor?.toLowerCase() ?? "";
          return (
            bettor === session.userAddress?.toLowerCase() &&
            log.args.sessionKey === sessionKey
          );
        });

          if (!matchedLog) {
            return NextResponse.json(
              { success: false, error: "BET_EVENT_NOT_FOUND" },
              { status: 409 },
            );
          }

          const eventAmount = matchedLog.args.amount ?? 0n;

          const escrowAtBlock = await wagerVaultPublicClient.readContract({
            address: WAGER_VAULT_ADDRESS,
            abi: WAGER_VAULT_ABI,
            functionName: "escrow",
            args: [sessionKey],
            blockNumber: receipt.blockNumber,
          });

          if (escrowAtBlock === 0n) {
            return NextResponse.json(
              { success: false, error: "WAGER_NOT_FOUND_ONCHAIN" },
              { status: 409 },
            );
          }

          if (escrowAtBlock !== wagerValue || eventAmount !== wagerValue) {
            return NextResponse.json(
              { success: false, error: "WAGER_MISMATCH_ONCHAIN" },
              { status: 409 },
            );
          }
        }
      } catch (error) {
        console.error("[API] registerWager escrow verification failed:", error);
        return NextResponse.json(
          { success: false, error: "WAGER_VERIFICATION_FAILED" },
          { status: 502 },
        );
      }

      updateSessionRecord(session.id, { wagerWei: normalizedWager });

      return NextResponse.json({
        success: true,
        sessionId,
        wagerWei: normalizedWager,
        chainId: DEGENSHOOT_CHAIN_ID,
      });
    }

    if (action === "cashOut") {
      if (session.status !== "active") {
        return NextResponse.json({ success: false, error: "SESSION_NOT_ACTIVE" }, { status: 409 });
      }

      const summary = buildSummary(session.completedRows, session.currentMultiplier);
      updateSessionRecord(session.id, {
        status: "cashout",
        currentRow: Math.min(session.currentRow, session.rows.length),
        roundSummary: summary,
        finalizedAt: Date.now(),
      });

      return NextResponse.json({
        success: true,
        sessionId,
        result: "cashout",
        status: "cashout",
        currentMultiplier: session.currentMultiplier,
        completedRows: session.completedRows,
        summary,
        chainId: DEGENSHOOT_CHAIN_ID,
      });
    }

    return NextResponse.json({ success: false, error: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (error) {
    console.error("[API] /degenshoot/action failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "ACTION_FAILED",
      },
      { status: 500 },
    );
  }
}
