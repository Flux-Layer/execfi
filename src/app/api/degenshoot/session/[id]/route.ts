import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;

    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        serverSeed: true,
        serverSeedHash: true,
        clientSeed: true,
        nonceBase: true,
        rows: true,
        status: true,
        lockedTileCounts: true,
        completedRows: true,
        currentMultiplier: true,
        wagerWei: true,
        createdAt: true,
        finalizedAt: true,
        wagerTxHash: true,
        resultTxHash: true,
        xpTxHash: true,
        verifiedAt: true,
        verifiedBy: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Only reveal server seed if session is finalized
    if (session.status === 'active') {
      return NextResponse.json(
        { error: 'Cannot access active session details' },
        { status: 403 }
      );
    }

    const safeSession = JSON.parse(
      JSON.stringify(session, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json(safeSession);
  } catch (error) {
    console.error('Error fetching session details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
