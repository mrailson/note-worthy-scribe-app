import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, Download, Play, Pause, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { GeneratedAudio } from '@/types/ai4gp';

interface VoiceAudioPlayerProps {
  audio: GeneratedAudio;
}

export const VoiceAudioPlayer: React.FC<VoiceAudioPlayerProps> = ({ audio }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Convert base64 to blob URL on mount for reliable playback
  useEffect(() => {
    try {
      const byteCharacters = atob(audio.audioContent);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      console.log('🎵 Audio blob URL created, size:', blob.size, 'bytes');
      
      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.error('Failed to process audio:', err);
      setError('Failed to load audio');
      setIsLoading(false);
    }
  }, [audio.audioContent]);

  const handlePlayPause = async () => {
    if (!audioRef.current) return;
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        await audioRef.current.play();
      }
    } catch (err) {
      console.error('Playback error:', err);
      toast.error('Failed to play audio');
    }
  };

  const handleRestart = async () => {
    if (!audioRef.current) return;
    
    try {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
    } catch (err) {
      console.error('Restart error:', err);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      console.log('🎵 Audio loaded, duration:', dur);
      setDuration(dur);
      setIsLoading(false);
    }
  };

  const handleCanPlay = () => {
    console.log('🎵 Audio can play');
    setIsLoading(false);
  };

  const handleError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    console.error('🎵 Audio error:', e);
    setError('Failed to load audio');
    setIsLoading(false);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleDownload = () => {
    try {
      const byteCharacters = atob(audio.audioContent);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mpeg' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voice-${audio.voiceName.toLowerCase()}-${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Audio file downloaded!');
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to download audio file');
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (error) {
    return (
      <div className="mt-4 p-4 bg-destructive/10 rounded-lg border border-destructive/50">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-primary/10 rounded-full">
          <Volume2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <span className="text-sm font-medium">Generated Voice File</span>
          <span className="text-xs text-muted-foreground ml-2">
            Voice: {audio.voiceName}
          </span>
        </div>
      </div>
      
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={handleCanPlay}
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={handleError}
        />
      )}
      
      {/* Progress bar */}
      <div className="w-full h-2 bg-muted rounded-full mb-3 overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-100"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      
      {/* Time display */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      
      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePlayPause}
          disabled={isLoading || !audioUrl}
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading
            </>
          ) : isPlaying ? (
            <>
              <Pause className="h-4 w-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Play
            </>
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRestart}
          disabled={isLoading || !audioUrl}
          title="Restart"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        
        <div className="flex-1" />
        
        <Button
          variant="default"
          size="sm"
          onClick={handleDownload}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Download MP3
        </Button>
      </div>
    </div>
  );
};
