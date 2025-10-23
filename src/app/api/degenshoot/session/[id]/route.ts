import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;

    const sessionRaw = await prisma.gameSession.findUnique({
      where: { id: sessionId },
    });

    if (!sessionRaw) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Only reveal server seed if session is finalized
    if (sessionRaw.status === 'active') {
      return NextResponse.json(
        { error: 'Cannot access active session details' },
        { status: 403 }
      );
    }

    const session = sessionRaw as typeof sessionRaw & {
      wagerTxHash?: string | null;
      resultTxHash?: string | null;
      xpTxHash?: string | null;
      verifiedAt?: Date | null;
      verifiedBy?: string | null;
    };

    const createdAt =
      typeof session.createdAt === 'bigint'
        ? session.createdAt.toString()
        : session.createdAt ?? null;
    const finalizedAt =
      typeof session.finalizedAt === 'bigint'
        ? session.finalizedAt.toString()
        : session.finalizedAt ?? null;

    const safeSession = {
      id: session.id,
      serverSeed: session.serverSeed,
      serverSeedHash: session.serverSeedHash,
      clientSeed: session.clientSeed,
      nonceBase: session.nonceBase,
      rows: session.rows,
      status: session.status,
      lockedTileCounts: session.lockedTileCounts,
      completedRows: session.completedRows,
      currentMultiplier: session.currentMultiplier,
      wagerWei: session.wagerWei,
      createdAt,
      finalizedAt,
      wagerTxHash: session.wagerTxHash ?? null,
      resultTxHash: session.resultTxHash ?? null,
      xpTxHash: session.xpTxHash ?? null,
      verifiedAt: session.verifiedAt ? session.verifiedAt.toISOString() : null,
      verifiedBy: session.verifiedBy ?? null,
    };

    return NextResponse.json(safeSession);
  } catch (error) {
    console.error('Error fetching session details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
