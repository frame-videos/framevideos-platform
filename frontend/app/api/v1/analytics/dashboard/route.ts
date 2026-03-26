export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '30d';

    // Mock data - replace with real database queries
    const data = {
      overview: {
        totalViews: 1245789,
        totalVideos: 342,
        totalLikes: 45623,
        avgWatchTime: 185, // seconds
        trends: {
          views: 12.5,
          videos: 8.3,
          likes: 15.7,
          watchTime: 5.2,
        },
      },
      viewsOverTime: generateViewsOverTime(period),
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}

function generateViewsOverTime(period: string) {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
  const data = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Generate realistic-looking data with some variation
    const baseViews = 30000;
    const variation = Math.sin(i / 7) * 10000; // Weekly pattern
    const randomFactor = Math.random() * 5000;
    const views = Math.floor(baseViews + variation + randomFactor);

    data.push({
      date: date.toISOString().split('T')[0],
      views,
    });
  }

  return data;
}
