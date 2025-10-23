import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { formatEther } from 'viem';
import type { GameHistoryResponse } from '@/types/game';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract and validate query parameters
    const userAddress = searchParams.get('userAddress')?.toLowerCase();
    if (!userAddress) {
      return NextResponse.json(
        { error: 'userAddress is required' },
        { status: 400 }
      );
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address' },
        { status: 400 }
      );
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') || undefined;
    const excludeActive = searchParams.get('excludeActive') === 'true';
    const sortBy = (searchParams.get('sortBy') || 'createdAt') as 'createdAt' | 'finalizedAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Build where clause
    const where: any = {
      userAddress,
      // Removed isActive filter to show full lifetime history
    };

    if (status) {
      where.status = status;
    } else if (excludeActive) {
      // Only show completed games (won or lost), exclude active/ongoing sessions
      // Include 'cashout' and 'submitted' as they represent successfully completed games
      where.status = {
        in: ['completed', 'lost', 'cashout', 'submitted', 'revealed']
      };
    }

    // Fetch sessions with pagination
    const [sessionsRaw, totalCount] = await Promise.all([
      prisma.gameSession.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
        select: {
          id: true,
          createdAt: true,
          finalizedAt: true,
          status: true,
          wagerWei: true,
          currentMultiplier: true,
          completedRows: true,
          resultTxHash: true,
          withdrawTxHash: true,
          wagerTxHash: true,
          serverSeedHash: true,
          serverSeed: true,
          verifiedAt: true,
          verifiedBy: true,
          roundSummary: true,
          rows: true,
        },
      }),
      prisma.gameSession.count({ where }),
    ]);

    type GameSessionWithTx = (typeof sessionsRaw)[number] & {
      resultTxHash?: string | null;
      verifiedAt?: Date | null;
      verifiedBy?: string | null;
    };
    const sessions = sessionsRaw as GameSessionWithTx[];

    // Transform to display format
    const historyItems = sessions.map(session => {
      const betAmount = session.wagerWei
        ? formatEther(BigInt(session.wagerWei))
        : '0';

      // Check if game was lost by looking for a crashed row
      const hasCrashedRow = Array.isArray(session.rows) &&
        session.rows.some((row: any) => row.crashed === true);

      const result =
        session.status === 'lost' || hasCrashedRow ? 'loss' :
        session.status === 'completed' ||
        session.status === 'cashout' ||
        session.status === 'submitted' ||
        session.status === 'revealed' ? 'win' :
        'active';

      return {
        id: session.id,
        date: new Date(Number(session.createdAt)),
        status: session.status as import('@/types/game').GameStatus,
        betAmount,
        result: result as 'win' | 'loss' | 'active',
        multiplier: session.currentMultiplier,
        rows: session.completedRows,
        payoutTxHash: session.resultTxHash,
        withdrawTxHash: session.withdrawTxHash || session.resultTxHash,
        serverSeedHash: session.serverSeedHash,
        serverSeed: session.serverSeed,
        isVerified: !!session.verifiedAt,
        canVerify: !!session.serverSeed && session.status !== 'active',
      };
    });

    const response: GameHistoryResponse = {
      items: historyItems,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching game history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
