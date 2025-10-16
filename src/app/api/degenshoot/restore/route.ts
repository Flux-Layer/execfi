import { NextResponse } from 'next/server';
import { restoreUserSession } from '../sessionStore';

export async function POST(request: Request) {
  try {
    const { userAddress } = await request.json();
    if (!userAddress) {
      return NextResponse.json({ error: 'User address required' }, { status: 400 });
    }

    const session = await restoreUserSession(userAddress.toLowerCase());
    return NextResponse.json({
      session: session ? {
        id: session.id,
        serverSeedHash: session.serverSeedHash,
        clientSeed: session.clientSeed,
        nonceBase: session.nonceBase,
        status: session.status,
        currentRow: session.currentRow,
        currentMultiplier: session.currentMultiplier,
        completedRows: session.completedRows,
        rows: session.rows,
        wagerWei: session.wagerWei,
        lockedTileCounts: session.lockedTileCounts,
      } : null,
      restored: !!session,
    });
  } catch (error) {
    console.error('[API] /degenshoot/restore failed:', error);
    return NextResponse.json({ error: 'Failed to restore session' }, { status: 500 });
  }
}
