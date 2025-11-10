import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

interface AudioSummaryPlayerProps {
  audioUrl?: string;
  duration?: number;
}

export function AudioSummaryPlayer({ audioUrl, duration = 180 }: AudioSummaryPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [effectiveDuration, setEffectiveDuration] = useState(duration);
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const sourceUrlRef = useRef<string | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!audioUrl) return;
    let aborted = false;

    const preload = async () => {
      try {
        setIsBuffering(true);
        const res = await fetch(audioUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (aborted) return;

        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = URL.createObjectURL(blob);

        if (audioRef.current && objectUrlRef.current) {
          audioRef.current.src = objectUrlRef.current;
          audioRef.current.load();
          audioRef.current.onloadedmetadata = () => {
            if (audioRef.current?.duration && isFinite(audioRef.current.duration)) {
              setEffectiveDuration(audioRef.current.duration);
            }
          };
          audioRef.current.onerror = () => {
            toast.error('Unable to load audio summary');
          };
        }
        setIsBuffering(false);
      } catch (e) {
        console.error('Audio preload error:', e);
        toast.error('Unable to load audio summary');
        setIsBuffering(false);
      }
    };

    preload();
    return () => {
      aborted = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [audioUrl]);

  const handlePlayPause = () => {
    if (!audioUrl) {
      toast.info('Audio Summary Demo', {
        description: 'This is a demonstration feature. In production, AI-generated audio summaries would play here.',
      });
      return;
    }
    
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch((error) => {
          console.error('Audio playback error:', error);
          toast.error('Audio playback failed. Please try again.');
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSliderChange = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  return (
    <Card className="p-3 bg-accent/30 border-accent w-[200px]">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePlayPause}
            className="h-8 w-8 p-0"
            title={audioUrl ? 'Play/Pause audio summary' : 'Demo feature - no audio available'}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <div className="text-xs text-muted-foreground font-mono">
            {formatTime(currentTime)} / {formatTime(effectiveDuration)}
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-foreground">Audio Summary</p>
            {!audioUrl && (
              <span className="text-[8px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Demo</span>
            )}
          </div>
          <Slider
            value={[currentTime]}
            max={effectiveDuration}
            step={1}
            onValueChange={handleSliderChange}
            className="w-full"
            disabled={!audioUrl || isBuffering}
          />
        </div>
      </div>

      {audioUrl && (
        <audio
          ref={audioRef}
          src={objectUrlRef.current ?? undefined}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
        />
      )}
    </Card>
  );
}
