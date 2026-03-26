export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

interface AnalyticsEvent {
  event: 'view' | 'watch_time' | 'completion';
  timestamp: number;
  watchTime?: number;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const videoId = params.id;
    const body: AnalyticsEvent = await request.json();

    // Log the analytics event
    console.log(`[Analytics] Video ${videoId}:`, {
      event: body.event,
      timestamp: new Date(body.timestamp).toISOString(),
      watchTime: body.watchTime || 'N/A',
    });

    // In production, you would:
    // 1. Store in database (e.g., Prisma, Drizzle)
    // 2. Update video stats (views, watch time)
    // 3. Track user engagement
    // 4. Send to analytics service (e.g., Google Analytics, Mixpanel)

    // Example database operations:
    // if (body.event === 'view') {
    //   await db.video.update({
    //     where: { id: videoId },
    //     data: { views: { increment: 1 } }
    //   });
    // }
    //
    // if (body.event === 'watch_time') {
    //   await db.analytics.create({
    //     data: {
    //       videoId,
    //       event: 'watch_time',
    //       watchTime: body.watchTime,
    //       timestamp: new Date(body.timestamp),
    //     }
    //   });
    // }
    //
    // if (body.event === 'completion') {
    //   await db.analytics.create({
    //     data: {
    //       videoId,
    //       event: 'completion',
    //       timestamp: new Date(body.timestamp),
    //     }
    //   });
    // }

    return NextResponse.json({ 
      success: true,
      message: `${body.event} tracked successfully`,
      videoId,
    });
  } catch (error) {
    console.error('Analytics tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track analytics' },
      { status: 500 }
    );
  }
}
