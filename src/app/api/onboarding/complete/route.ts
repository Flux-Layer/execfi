import { NextResponse } from 'next/server';
import { completeTutorial } from '@/lib/tutorial/service';

export async function POST(request: Request) {
  try {
    const { userAddress } = await request.json();
    if (!userAddress) {
      return NextResponse.json({ error: 'User address required' }, { status: 400 });
    }
    await completeTutorial(userAddress);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] /onboarding/complete failed:', error);
    return NextResponse.json({ error: 'Failed to complete tutorial' }, { status: 500 });
  }
}
