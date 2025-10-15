import { NextResponse } from 'next/server';
import { skipTutorial } from '@/lib/tutorial/service';

export async function POST(request: Request) {
  try {
    const { userAddress } = await request.json();
    if (!userAddress) {
      return NextResponse.json({ error: 'User address required' }, { status: 400 });
    }
    await skipTutorial(userAddress);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] /onboarding/skip failed:', error);
    return NextResponse.json({ error: 'Failed to skip tutorial' }, { status: 500 });
  }
}
