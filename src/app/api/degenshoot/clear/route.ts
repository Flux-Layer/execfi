import { NextResponse } from 'next/server';
import { clearUserSessions } from '../sessionStore';

export async function POST(request: Request) {
  try {
    const { userAddress } = await request.json();
    if (!userAddress) {
      return NextResponse.json({ error: 'User address required' }, { status: 400 });
    }

    const count = await clearUserSessions(userAddress.toLowerCase());
    return NextResponse.json({ success: true, clearedCount: count });
  } catch (error) {
    console.error('[API] /degenshoot/clear failed:', error);
    return NextResponse.json({ error: 'Failed to clear sessions' }, { status: 500 });
  }
}
