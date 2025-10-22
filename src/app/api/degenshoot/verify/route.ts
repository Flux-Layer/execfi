import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import type { VerificationRequest, VerificationResponse } from '@/types/game';

export async function POST(request: NextRequest) {
  try {
    const body: VerificationRequest = await request.json();
    const { sessionId, userAddress, verifiedHash } = body;

    if (!sessionId || !userAddress) {
      return NextResponse.json(
        { success: false, error: 'sessionId and userAddress are required' },
        { status: 400 }
      );
    }

    // Verify session exists and belongs to user
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: {
        userAddress: true,
        serverSeedHash: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.userAddress?.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Session does not belong to this user' },
        { status: 403 }
      );
    }

    // Optional: Verify the hash matches
    if (verifiedHash && verifiedHash !== session.serverSeedHash) {
      return NextResponse.json(
        { success: false, error: 'Hash verification failed' },
        { status: 400 }
      );
    }

    // Update verification status
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        verifiedAt: new Date(),
        verifiedBy: userAddress.toLowerCase(),
      },
    });

    const response: VerificationResponse = { success: true };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error marking session as verified:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
