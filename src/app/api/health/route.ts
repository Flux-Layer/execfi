import { NextResponse } from 'next/server';
import { dbHealthCheck, prisma } from '@/lib/db/client';

export async function GET() {
  try {
    const dbHealthy = await dbHealthCheck();
    const [activeSessions, totalSessions] = await Promise.all([
      prisma.gameSession.count({ where: { isActive: true } }),
      prisma.gameSession.count(),
    ]);

    return NextResponse.json({
      status: dbHealthy ? 'healthy' : 'degraded',
      database: dbHealthy,
      stats: { activeSessions, totalSessions },
      timestamp: new Date().toISOString(),
    }, { status: dbHealthy ? 200 : 503 });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: (error as Error).message,
    }, { status: 503 });
  }
}
