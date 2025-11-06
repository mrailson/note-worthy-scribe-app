import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, RefreshCw, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useVoicePreference } from '@/hooks/useVoicePreference';

interface AudioOverviewPlayerProps {
  meetingId: string;
  audioOverviewUrl?: string;
  audioOverviewText?: string;
  audioOverviewDuration?: number;
  onRegenerateAudio?: (voiceProvider?: string, voiceId?: string) => void;
  className?: string;
}

export const AudioOverviewPlayer = ({ 
  meetingId, 
  audioOverviewUrl,
  audioOverviewText,
  audioOverviewDuration,
  onRegenerateAudio,
  className = ""
}: AudioOverviewPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    const saved = localStorage.getItem('audioPlaybackSpeed');
    return saved ? parseFloat(saved) : 1;
  });
  const [showTranscript, setShowTranscript] = useState(false);
  const { voiceConfig } = useVoicePreference();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const sourceUrlRef = useRef<string | null>(null);

  const handlePlayAudio = async () => {
    if (!audioOverviewUrl) {
      console.log('❌ No audio URL available');
      toast.error('No audio URL available');
      return;
    }

    try {
      if (audioRef.current && isPlaying) {
        console.log('⏸️ Pausing audio');
        audioRef.current.pause();
        setIsPlaying(false);
        return;
      }

      if (sourceUrlRef.current !== audioOverviewUrl || !audioObjectUrlRef.current) {
        console.log('⬇️ Downloading audio to blob URL due to CSP');
        const res = await fetch(audioOverviewUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (!blob.type.startsWith('audio/')) {
          console.warn('Unexpected MIME type:', blob.type);
        }
        if (audioObjectUrlRef.current) {
          URL.revokeObjectURL(audioObjectUrlRef.current);
        }
        audioObjectUrlRef.current = URL.createObjectURL(blob);
        sourceUrlRef.current = audioOverviewUrl;
        console.log('✅ Blob URL ready');
      }

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('ended', () => {});
        audioRef.current.removeEventListener('error', () => {});
        audioRef.current = null;
      }

      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
      audioRef.current.playbackRate = playbackSpeed;
      
      audioRef.current.addEventListener('ended', () => {
        console.log('✅ Audio playback ended');
        setIsPlaying(false);
        // Resume microphones after playback completes
        import('@/utils/AudioFocusManager').then(({ audioFocusManager }) => {
          audioFocusManager.resumeAll();
        });
      });
      
      audioRef.current.addEventListener('error', (e) => {
        console.error('❌ Audio playback error:', e);
        console.error('Audio URL (blob):', audioObjectUrlRef.current);
        toast.error('Failed to play audio - check console for details');
        setIsPlaying(false);
        // Resume microphones on error
        import('@/utils/AudioFocusManager').then(({ audioFocusManager }) => {
          audioFocusManager.resumeAll();
        });
      });

      // AUDIO CUTOUT FIX: Pause microphones, play silent pre-roll, then start audio
      const { audioFocusManager, playoutSilentPreRoll, fadeInVolume } = await import('@/utils/AudioFocusManager');
      
      // Step 1: Pause any active microphones
      await audioFocusManager.pauseAll('audio_playback');
      
      // Step 2: Play silent audio to warm up device (prevents Bluetooth profile switching glitch)
      await playoutSilentPreRoll(500);
      
      // Step 3: Set up audio element with zero volume initially
      audioRef.current.volume = 0;

      await new Promise<void>((resolve, reject) => {
        const onCanPlayThrough = () => {
          audioRef.current?.removeEventListener('canplaythrough', onCanPlayThrough);
          audioRef.current?.removeEventListener('error', onError);
          resolve();
        };
        
        const onError = (e: Event) => {
          audioRef.current?.removeEventListener('canplaythrough', onCanPlayThrough);
          audioRef.current?.removeEventListener('error', onError);
          reject(new Error('Failed to load audio'));
        };

        audioRef.current?.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
        audioRef.current?.addEventListener('error', onError, { once: true });
        
        if (audioRef.current) {
          audioRef.current.src = audioObjectUrlRef.current!;
          audioRef.current.load();
        }
      });

      // Step 4: Start playback at zero volume
      console.log('▶️ Playing audio');
      await audioRef.current.play();
      setIsPlaying(true);
      
      // Step 5: Fade in volume smoothly
      fadeInVolume(audioRef.current, 1, 400);
    } catch (error: any) {
      console.error('❌ Play error:', error);
      toast.error(`Playback error: ${error.message}`);
      setIsPlaying(false);
    }
  };

  const handleRegenerateAudio = async () => {
    if (!onRegenerateAudio) return;
    
    setIsGeneratingAudio(true);
    try {
      await onRegenerateAudio(voiceConfig.provider, voiceConfig.voiceId);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current);
        audioObjectUrlRef.current = null;
      }
      sourceUrlRef.current = null;
      setIsPlaying(false);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current);
        audioObjectUrlRef.current = null;
      }
      sourceUrlRef.current = null;
    };
  }, []);

  const handleDownloadAudio = async () => {
    if (!audioOverviewUrl) {
      toast.error('No audio available to download');
      return;
    }

    try {
      const res = await fetch(audioOverviewUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-overview-${meetingId}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Audio downloaded');
    } catch (error: any) {
      console.error('❌ Download error:', error);
      toast.error(`Download failed: ${error.message}`);
    }
  };

  const handleSpeedChange = (speed: string) => {
    const speedValue = parseFloat(speed);
    setPlaybackSpeed(speedValue);
    localStorage.setItem('audioPlaybackSpeed', speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speedValue;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {audioOverviewDuration && (
            <span className="text-sm text-muted-foreground">
              Duration: {formatDuration(audioOverviewDuration)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {audioOverviewUrl && (
            <>
              <Select value={playbackSpeed.toString()} onValueChange={handleSpeedChange}>
                <SelectTrigger className="h-8 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.75">0.75×</SelectItem>
                  <SelectItem value="1">1×</SelectItem>
                  <SelectItem value="1.25">1.25×</SelectItem>
                  <SelectItem value="1.5">1.5×</SelectItem>
                  <SelectItem value="1.75">1.75×</SelectItem>
                  <SelectItem value="2">2×</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handlePlayAudio}
                variant="outline"
                size="sm"
                className="h-8 px-3"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Play
                  </>
                )}
              </Button>
              <Button
                onClick={handleDownloadAudio}
                variant="outline"
                size="sm"
                className="h-8 px-3"
              >
                <Download className="h-4 w-4" />
              </Button>
            </>
          )}
          {onRegenerateAudio && (
            <Button
              onClick={handleRegenerateAudio}
              variant="ghost"
              size="sm"
              className="h-8 px-3"
              disabled={isGeneratingAudio}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isGeneratingAudio ? 'animate-spin' : ''}`} />
              {isGeneratingAudio ? 'Generating...' : audioOverviewUrl ? 'Regenerate' : 'Generate'}
            </Button>
          )}
        </div>
      </div>
      {!audioOverviewUrl && !isGeneratingAudio && (
        <p className="text-sm text-muted-foreground">
          Generate a 2-minute spoken overview of this meeting
        </p>
      )}
      
      {audioOverviewText && (
        <div className="mt-3">
          <Button
            onClick={() => setShowTranscript(!showTranscript)}
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs mb-2"
          >
            {showTranscript ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Hide Transcript
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show Transcript
              </>
            )}
          </Button>
          {showTranscript && (
            <div className="p-3 bg-muted/30 rounded-md border border-border/50">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {audioOverviewText}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
