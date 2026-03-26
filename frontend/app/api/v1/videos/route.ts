export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

// Mock database
const mockVideos = [
  {
    id: '1',
    title: 'Introduction to React Server Components',
    description: 'Learn how to build modern React applications with Server Components.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'https://picsum.photos/seed/video1/1280/720',
    views: 125430,
    likes: 8234,
    createdAt: '2024-03-20T10:00:00Z',
    user: {
      id: 'user1',
      name: 'Tech Academy',
      avatar: 'https://i.pravatar.cc/150?u=user1',
    },
  },
  {
    id: '2',
    title: 'Building a Full-Stack App with Next.js 14',
    description: 'Complete guide to building production-ready applications.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailUrl: 'https://picsum.photos/seed/video2/1280/720',
    views: 98765,
    likes: 6543,
    createdAt: '2024-03-19T14:30:00Z',
    user: {
      id: 'user2',
      name: 'Code Masters',
      avatar: 'https://i.pravatar.cc/150?u=user2',
    },
  },
  {
    id: '3',
    title: 'TypeScript Best Practices 2024',
    description: 'Modern TypeScript patterns and practices.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://picsum.photos/seed/video3/1280/720',
    views: 87654,
    likes: 5432,
    createdAt: '2024-03-18T09:15:00Z',
    user: {
      id: 'user3',
      name: 'TypeScript Pro',
      avatar: 'https://i.pravatar.cc/150?u=user3',
    },
  },
  {
    id: '4',
    title: 'CSS Grid vs Flexbox: Complete Guide',
    description: 'Master modern CSS layout techniques.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: 'https://picsum.photos/seed/video4/1280/720',
    views: 76543,
    likes: 4321,
    createdAt: '2024-03-17T16:45:00Z',
    user: {
      id: 'user4',
      name: 'CSS Wizard',
      avatar: 'https://i.pravatar.cc/150?u=user4',
    },
  },
  {
    id: '5',
    title: 'Database Design Fundamentals',
    description: 'Learn database design principles and best practices.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnailUrl: 'https://picsum.photos/seed/video5/1280/720',
    views: 65432,
    likes: 3987,
    createdAt: '2024-03-16T11:20:00Z',
    user: {
      id: 'user5',
      name: 'Database Guru',
      avatar: 'https://i.pravatar.cc/150?u=user5',
    },
  },
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');
    const exclude = searchParams.get('exclude');

    let videos = [...mockVideos];

    // Exclude specific video (for related videos)
    if (exclude) {
      videos = videos.filter(v => v.id !== exclude);
    }

    // Limit results
    videos = videos.slice(0, limit);

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Get videos error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    );
  }
}
