export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

// Mock in-memory storage (replace with database)
const userLikes = new Map<string, Set<string>>();

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const videoId = params.id;
    // Mock user ID (in production, get from session/JWT)
    const userId = 'current-user';

    const isLiked = userLikes.get(userId)?.has(videoId) || false;

    return NextResponse.json({ isLiked });
  } catch (error) {
    console.error('Check like error:', error);
    return NextResponse.json(
      { error: 'Failed to check like status' },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const videoId = params.id;
    // Mock user ID (in production, get from session/JWT)
    const userId = 'current-user';

    if (!userLikes.has(userId)) {
      userLikes.set(userId, new Set());
    }

    userLikes.get(userId)!.add(videoId);

    console.log(`[Like] User ${userId} liked video ${videoId}`);

    // In production:
    // await db.like.create({
    //   data: { userId, videoId }
    // });
    // await db.video.update({
    //   where: { id: videoId },
    //   data: { likes: { increment: 1 } }
    // });

    return NextResponse.json({ 
      success: true,
      isLiked: true,
    });
  } catch (error) {
    console.error('Like error:', error);
    return NextResponse.json(
      { error: 'Failed to like video' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const videoId = params.id;
    // Mock user ID (in production, get from session/JWT)
    const userId = 'current-user';

    userLikes.get(userId)?.delete(videoId);

    console.log(`[Unlike] User ${userId} unliked video ${videoId}`);

    // In production:
    // await db.like.delete({
    //   where: { userId_videoId: { userId, videoId } }
    // });
    // await db.video.update({
    //   where: { id: videoId },
    //   data: { likes: { decrement: 1 } }
    // });

    return NextResponse.json({ 
      success: true,
      isLiked: false,
    });
  } catch (error) {
    console.error('Unlike error:', error);
    return NextResponse.json(
      { error: 'Failed to unlike video' },
      { status: 500 }
    );
  }
}
