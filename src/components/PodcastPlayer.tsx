import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Volume2, VolumeX, Download, Headphones } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PodcastPlayerProps {
  src: string;
  title?: string;
  className?: string;
}

export const PodcastPlayer: React.FC<PodcastPlayerProps> = ({ 
  src, 
  title = "Notewell AI Podcast",
  className 
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Playback error:', err);
    }
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    const newTime = value[0];
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return;
    const newVolume = value[0];
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = 'notewell-ai-podcast.mp3';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn("p-3 bg-muted/40 rounded-lg border border-border/50", className)}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        <Headphones className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs font-medium text-foreground truncate flex-1">{title}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          className="h-7 px-2 text-xs gap-1"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Download</span>
        </Button>
      </div>

      {/* Player controls row */}
      <div className="flex items-center gap-2">
        {/* Play/Pause */}
        <Button
          variant={isPlaying ? "secondary" : "default"}
          size="sm"
          onClick={togglePlay}
          disabled={!isLoaded}
          className="h-8 w-8 p-0 shrink-0"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        {/* Time & Timeline */}
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {formatTime(currentTime)}
        </span>
        <Slider
          value={[currentTime]}
          onValueChange={handleSeek}
          max={duration || 100}
          step={0.1}
          className="flex-1"
          disabled={!isLoaded}
        />
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {formatTime(duration)}
        </span>

        {/* Volume - desktop only */}
        <div className="hidden sm:flex items-center gap-1 ml-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMute}
            className="h-7 w-7 p-0"
          >
            {isMuted ? (
              <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            onValueChange={handleVolumeChange}
            max={1}
            step={0.01}
            className="w-16"
          />
        </div>
      </div>
    </div>
  );
};