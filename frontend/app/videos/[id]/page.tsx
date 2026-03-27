import dynamic from 'next/dynamic';

const VideoPageClient = dynamic(() => import('./VideoPageClient'), { ssr: false });

export function generateStaticParams() {
  return [{ id: 'watch' }];
}

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VideoPageClient videoId={id} />;
}
