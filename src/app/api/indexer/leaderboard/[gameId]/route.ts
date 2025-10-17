import { NextRequest, NextResponse } from 'next/server';
import { queryPonder } from '@/lib/indexer/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await props.params;
    const { searchParams } = new URL(request.url);

    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Handle "global" leaderboard
    const isGlobal = gameId === 'global';

    let sql: string;
    let queryParams: any[];

    if (isGlobal) {
      // Query from ponder.leaderboard table (pre-computed)
      sql = `
        SELECT
          user_address, rank, xp, last_updated
        FROM leaderboard
        WHERE game_id IS NULL
        ORDER BY rank ASC
        LIMIT $1 OFFSET $2
      `;
      queryParams = [limit, offset];
    } else {
      // Query from leaderboard table for specific game
      sql = `
        SELECT
          user_address, rank, xp, last_updated
        FROM leaderboard
        WHERE game_id = $1
        ORDER BY rank ASC
        LIMIT $2 OFFSET $3
      `;
      queryParams = [gameId, limit, offset];
    }

    const results = await queryPonder(sql, queryParams);

    // Get total count
    const countSql = isGlobal
      ? `SELECT COUNT(*) as total FROM leaderboard WHERE game_id IS NULL`
      : `SELECT COUNT(*) as total FROM leaderboard WHERE game_id = $1`;

    const countParams = isGlobal ? [] : [gameId];
    const countResult = await queryPonder(countSql, countParams);
    const total = parseInt(countResult[0]?.total || '0', 10);

    return NextResponse.json({
      gameId: isGlobal ? 'global' : gameId,
      leaderboard: results,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
