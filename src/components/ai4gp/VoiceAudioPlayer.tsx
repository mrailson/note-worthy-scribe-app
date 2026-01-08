import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, Download, Play, Pause, RotateCcw } from 'lucide-react';
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

  const audioUrl = `data:audio/mpeg;base64,${audio.audioContent}`;

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleDownload = () => {
    try {
      // Convert base64 to blob
      const byteCharacters = atob(audio.audioContent);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mpeg' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voice-${audio.voiceName.toLowerCase()}-${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Audio file downloaded!');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download audio file');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

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
      
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      
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
          className="flex items-center gap-2"
        >
          {isPlaying ? (
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
