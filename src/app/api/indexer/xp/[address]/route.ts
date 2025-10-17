import { NextRequest, NextResponse } from 'next/server';
import { queryPonder } from '@/lib/indexer/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface UserXpRow {
  id: string;
  user_address: string;
  game_id: string;
  current_xp: string;
  total_xp_all_games: string;
  last_updated_block: string;
  last_updated_timestamp: string;
  transaction_count: number;
  created_at: string;
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await props.params;

    // Validate Ethereum address format
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address format' },
        { status: 400 }
      );
    }

    const normalizedAddress = address.toLowerCase();

    // Query user XP data from ponder schema
    const results = await queryPonder<UserXpRow>(
      `SELECT * FROM user_xp WHERE user_address = $1 ORDER BY game_id`,
      [normalizedAddress]
    );

    if (results.length === 0) {
      return NextResponse.json(
        { error: 'No XP data found for this address' },
        { status: 404 }
      );
    }

    // Transform BigInt strings to numbers for JSON
    const formatted = results.map(row => ({
      id: row.id,
      userAddress: row.user_address,
      gameId: row.game_id,
      currentXp: row.current_xp,
      totalXpAllGames: row.total_xp_all_games,
      lastUpdatedBlock: row.last_updated_block,
      lastUpdatedTimestamp: row.last_updated_timestamp,
      transactionCount: row.transaction_count,
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      address: normalizedAddress,
      xpData: formatted,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error fetching user XP:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
