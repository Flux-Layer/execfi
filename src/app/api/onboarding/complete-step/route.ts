import { NextResponse } from 'next/server';
import { completeStep } from '@/lib/tutorial/service';

export async function POST(request: Request) {
  try {
    const { userAddress, stepId } = await request.json();
    if (!userAddress || !stepId) {
      return NextResponse.json({ error: 'User address and stepId required' }, { status: 400 });
    }
    await completeStep(userAddress, stepId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] /onboarding/complete-step failed:', error);
    return NextResponse.json({ error: 'Failed to complete step' }, { status: 500 });
  }
}
