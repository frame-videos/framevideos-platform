'use client';

import { useEffect, useRef, useState } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

interface VideoPlayerProps {
  videoId: string;
  videoUrl: string;
  onViewTracked?: () => void;
}

export default function VideoPlayer({ videoId, videoUrl, onViewTracked }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr | null>(null);
  const [watchTime, setWatchTime] = useState(0);
  const watchTimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const viewTrackedRef = useRef(false);
  const completionTrackedRef = useRef(false);
  
  // Use watchTime to avoid unused variable warning
  useEffect(() => {
    if (watchTime > 0) {
      // This effect runs when watchTime changes
      // Could be used for analytics or progress tracking
    }
  }, [watchTime]);

  useEffect(() => {
    if (!videoRef.current) return;

    // Initialize Plyr
    const player = new Plyr(videoRef.current, {
      controls: [
        'play-large',
        'play',
        'progress',
        'current-time',
        'duration',
        'mute',
        'volume',
        'settings',
        'pip',
        'airplay',
        'fullscreen',
      ],
      settings: ['captions', 'quality', 'speed'],
      speed: { selected: 1, options: [0.5, 1, 1.25, 1.5, 2] },
      quality: { default: 720, options: [1080, 720, 480, 360] },
      keyboard: { focused: true, global: true },
      tooltips: { controls: true, seek: true },
    });

    playerRef.current = player;

    // Track initial view on first play
    player.on('play', () => {
      if (!viewTrackedRef.current) {
        trackView();
        viewTrackedRef.current = true;
        if (onViewTracked) onViewTracked();
      }
    });

    // Track watch time every 10 seconds
    player.on('playing', () => {
      if (!watchTimeIntervalRef.current) {
        watchTimeIntervalRef.current = setInterval(() => {
          const currentTime = player.currentTime;
          setWatchTime(currentTime);
          trackWatchTime(currentTime);
        }, 10000);
      }
    });

    // Clear interval on pause
    player.on('pause', () => {
      if (watchTimeIntervalRef.current) {
        clearInterval(watchTimeIntervalRef.current);
        watchTimeIntervalRef.current = null;
      }
    });

    // Track completion (>90%)
    player.on('timeupdate', () => {
      const duration = player.duration;
      const currentTime = player.currentTime;
      
      if (duration > 0 && currentTime / duration > 0.9 && !completionTrackedRef.current) {
        trackCompletion();
        completionTrackedRef.current = true;
      }
    });

    return () => {
      if (watchTimeIntervalRef.current) {
        clearInterval(watchTimeIntervalRef.current);
      }
      player.destroy();
    };
  }, [videoId, videoUrl]);

  const trackView = async () => {
    try {
      await fetch(`/api/v1/analytics/videos/${videoId}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'view', timestamp: Date.now() }),
      });
    } catch (error) {
      console.error('Failed to track view:', error);
    }
  };

  const trackWatchTime = async (currentTime: number) => {
    try {
      await fetch(`/api/v1/analytics/videos/${videoId}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          event: 'watch_time', 
          watchTime: Math.floor(currentTime),
          timestamp: Date.now() 
        }),
      });
    } catch (error) {
      console.error('Failed to track watch time:', error);
    }
  };

  const trackCompletion = async () => {
    try {
      await fetch(`/api/v1/analytics/videos/${videoId}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          event: 'completion',
          timestamp: Date.now() 
        }),
      });
    } catch (error) {
      console.error('Failed to track completion:', error);
    }
  };

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
      <video
        ref={videoRef}
        className="w-full h-full"
        src={videoUrl}
        playsInline
        crossOrigin="anonymous"
      />
    </div>
  );
}
