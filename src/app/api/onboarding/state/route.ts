import { NextResponse } from 'next/server';
import { getOnboardingState } from '@/lib/tutorial/service';

export async function POST(request: Request) {
  try {
    const { userAddress } = await request.json();
    if (!userAddress) {
      return NextResponse.json({ error: 'User address required' }, { status: 400 });
    }
    const state = await getOnboardingState(userAddress);
    return NextResponse.json({ state });
  } catch (error) {
    console.error('[API] /onboarding/state failed:', error);
    return NextResponse.json({ error: 'Failed to get state' }, { status: 500 });
  }
}
