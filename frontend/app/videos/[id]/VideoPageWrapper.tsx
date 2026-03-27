'use client';

import dynamic from 'next/dynamic';

const VideoPageClient = dynamic(() => import('./VideoPageClient'), { ssr: false });

export default function VideoPageWrapper({ videoId }: { videoId: string }) {
  return <VideoPageClient videoId={videoId} />;
}
