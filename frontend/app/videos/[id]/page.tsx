import VideoPageClient from './VideoPageClient';

export function generateStaticParams() {
  return [{ id: 'watch' }];
}

export const dynamicParams = false;

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VideoPageClient videoId={id} />;
}
