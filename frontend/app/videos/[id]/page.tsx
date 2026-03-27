import VideoPageWrapper from './VideoPageWrapper';

export function generateStaticParams() {
  return [{ id: 'watch' }];
}

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VideoPageWrapper videoId={id} />;
}
