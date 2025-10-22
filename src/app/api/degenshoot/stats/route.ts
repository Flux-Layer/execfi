import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { formatEther } from 'viem';
import type { UserStatistics } from '@/types/game';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress')?.toLowerCase();

    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json(
        { error: 'Valid userAddress is required' },
        { status: 400 }
      );
    }

    // Fetch all finalized sessions for this user
    const sessions = await prisma.gameSession.findMany({
      where: {
        userAddress,
        isActive: true,
        finalizedAt: { not: null },
      },
      select: {
        status: true,
        wagerWei: true,
        currentMultiplier: true,
        completedRows: true,
      },
      orderBy: {
        createdAt: 'asc', // For streak calculation
      },
    });

    // Calculate statistics
    let totalWageredWei = BigInt(0);
    let totalPayoutWei = BigInt(0);
    let gamesPlayed = 0;
    let gamesWon = 0;
    let gamesLost = 0;
    let maxMultiplier = 0;
    let totalMultiplier = 0;
    let highestPayoutWei = BigInt(0);

    // Track streaks
    let currentStreak = 0;
    let longestStreak = 0;

    for (const session of sessions) {
      gamesPlayed++;

      const wagerWei = session.wagerWei ? BigInt(session.wagerWei) : BigInt(0);
      totalWageredWei += wagerWei;

      if (session.status === 'completed') {
        gamesWon++;
        currentStreak++;

        const payoutWei = wagerWei * BigInt(Math.floor(session.currentMultiplier * 100)) / BigInt(100);
        totalPayoutWei += payoutWei;

        if (payoutWei > highestPayoutWei) {
          highestPayoutWei = payoutWei;
        }
      } else if (session.status === 'lost') {
        gamesLost++;
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
        currentStreak = 0;
      }

      totalMultiplier += session.currentMultiplier;
      if (session.currentMultiplier > maxMultiplier) {
        maxMultiplier = session.currentMultiplier;
      }
    }

    // Final streak check
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    const netProfitWei = totalPayoutWei - totalWageredWei;
    const avgMultiplier = gamesPlayed > 0 ? totalMultiplier / gamesPlayed : 0;
    const winRate = gamesPlayed > 0 ? (gamesWon / gamesPlayed) * 100 : 0;

    // Try to fetch on-chain stats from indexer
    let onChainStats = null;
    try {
      const indexerUrl = process.env.NEXT_PUBLIC_API_URL || '';
      if (indexerUrl) {
        const indexerResponse = await fetch(
          `${indexerUrl}/api/indexer/stats/${userAddress}`,
          { next: { revalidate: 60 } } // Cache for 60 seconds
        );
        if (indexerResponse.ok) {
          onChainStats = await indexerResponse.json();
        }
      }
    } catch (error) {
      console.error('Failed to fetch on-chain stats:', error);
      // Continue without on-chain stats
    }

    const stats: UserStatistics = {
      // Off-chain calculated stats
      totalWagered: formatEther(totalWageredWei),
      gamesPlayed,
      gamesWon,
      gamesLost,
      winRate: Math.round(winRate * 100) / 100,
      totalPayout: formatEther(totalPayoutWei),
      netProfit: formatEther(netProfitWei),
      avgMultiplier: Math.round(avgMultiplier * 100) / 100,
      maxMultiplier: Math.round(maxMultiplier * 100) / 100,
      highestPayout: formatEther(highestPayoutWei),
      longestStreak,

      // On-chain stats (if available)
      onChain: onChainStats ? {
        totalWagered: onChainStats.totalWagered,
        totalNetWinnings: onChainStats.totalNetWinnings,
        settledWagerCount: onChainStats.settledWagerCount,
      } : null,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error calculating stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
