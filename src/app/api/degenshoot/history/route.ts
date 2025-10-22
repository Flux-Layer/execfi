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
    const sortBy = (searchParams.get('sortBy') || 'createdAt') as 'createdAt' | 'finalizedAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Build where clause
    const where: any = {
      userAddress,
      // Removed isActive filter to show full lifetime history
    };

    if (status) {
      where.status = status;
    }

    // Fetch sessions with pagination
    const [sessions, totalCount] = await Promise.all([
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
          serverSeedHash: true,
          serverSeed: true,
          verifiedAt: true,
          verifiedBy: true,
          roundSummary: true,
        },
      }),
      prisma.gameSession.count({ where }),
    ]);

    // Transform to display format
    const historyItems = sessions.map(session => {
      const betAmount = session.wagerWei
        ? formatEther(BigInt(session.wagerWei))
        : '0';

      const result =
        session.status === 'completed' ? 'win' :
        session.status === 'lost' ? 'loss' :
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
