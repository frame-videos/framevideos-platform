export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

// Mock database
const mockVideos = [
  {
    id: '1',
    title: 'Introduction to React Server Components',
    description: 'Learn how to build modern React applications with Server Components. This comprehensive tutorial covers the fundamentals of RSC, data fetching patterns, and best practices for building performant web applications.',
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
    description: 'Complete guide to building production-ready applications with Next.js 14, covering app router, server actions, and modern deployment strategies.',
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
    description: 'Modern TypeScript patterns and practices for writing type-safe, maintainable code. Includes advanced types, generics, and real-world examples.',
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
];

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const videoId = params.id;
    const video = mockVideos.find(v => v.id === videoId);

    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(video);
  } catch (error) {
    console.error('Get video error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video' },
      { status: 500 }
    );
  }
}
