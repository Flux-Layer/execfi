import { NextRequest, NextResponse } from 'next/server';
import { queryPonder } from '@/lib/indexer/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await props.params;

    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid address' },
        { status: 400 }
      );
    }

    const normalizedAddress = address.toLowerCase();

    // Query user stats from ponder schema
    const sql = `
      SELECT
        id, total_xp, xp_transaction_count,
        first_xp_timestamp, last_xp_timestamp,
        games_played, sessions_completed,
        total_wagered, total_gross_winnings,
        total_net_winnings, total_fees_paid,
        wager_count, settled_wager_count,
        first_activity_timestamp, last_activity_timestamp,
        last_activity_block
      FROM user_stats
      WHERE id = $1
    `;

    const results = await queryPonder(sql, [normalizedAddress]);

    if (results.length === 0) {
      return NextResponse.json(
        { error: 'No stats found for this address' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      address: normalizedAddress,
      stats: results[0],
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
