export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    // const period = searchParams.get('period') || '30d'; // For future use
    const category = searchParams.get('category') || 'all';
    const limit = parseInt(searchParams.get('limit') || '10');

    // Mock data - replace with real database queries
    const videos = [
      {
        id: '1',
        title: 'Introduction to React Server Components',
        views: 125430,
        likes: 8234,
        avgWatchTime: 245,
        category: 'tech',
        thumbnail: 'https://picsum.photos/seed/video1/320/180',
      },
      {
        id: '2',
        title: 'Building a Full-Stack App with Next.js 14',
        views: 98765,
        likes: 6543,
        avgWatchTime: 312,
        category: 'tech',
        thumbnail: 'https://picsum.photos/seed/video2/320/180',
      },
      {
        id: '3',
        title: 'TypeScript Best Practices 2024',
        views: 87654,
        likes: 5432,
        avgWatchTime: 198,
        category: 'tech',
        thumbnail: 'https://picsum.photos/seed/video3/320/180',
      },
      {
        id: '4',
        title: 'CSS Grid vs Flexbox: Complete Guide',
        views: 76543,
        likes: 4321,
        avgWatchTime: 167,
        category: 'tech',
        thumbnail: 'https://picsum.photos/seed/video4/320/180',
      },
      {
        id: '5',
        title: 'Database Design Fundamentals',
        views: 65432,
        likes: 3987,
        avgWatchTime: 289,
        category: 'education',
        thumbnail: 'https://picsum.photos/seed/video5/320/180',
      },
      {
        id: '6',
        title: 'API Security Best Practices',
        views: 54321,
        likes: 3456,
        avgWatchTime: 223,
        category: 'tech',
        thumbnail: 'https://picsum.photos/seed/video6/320/180',
      },
      {
        id: '7',
        title: 'Understanding Docker Containers',
        views: 43210,
        likes: 2987,
        avgWatchTime: 276,
        category: 'tech',
        thumbnail: 'https://picsum.photos/seed/video7/320/180',
      },
      {
        id: '8',
        title: 'Git Workflow for Teams',
        views: 38765,
        likes: 2654,
        avgWatchTime: 189,
        category: 'tech',
        thumbnail: 'https://picsum.photos/seed/video8/320/180',
      },
      {
        id: '9',
        title: 'Performance Optimization Techniques',
        views: 32109,
        likes: 2321,
        avgWatchTime: 234,
        category: 'tech',
        thumbnail: 'https://picsum.photos/seed/video9/320/180',
      },
      {
        id: '10',
        title: 'Testing Strategies for Modern Apps',
        views: 28765,
        likes: 2098,
        avgWatchTime: 201,
        category: 'tech',
        thumbnail: 'https://picsum.photos/seed/video10/320/180',
      },
    ];

    // Filter by category if not 'all'
    const filteredVideos = category === 'all' 
      ? videos 
      : videos.filter(v => v.category === category);

    // Return limited results
    const data = {
      videos: filteredVideos.slice(0, limit),
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error('Analytics trending error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trending data' },
      { status: 500 }
    );
  }
}
