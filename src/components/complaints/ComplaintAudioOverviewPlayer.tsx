import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, RefreshCw, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useVoicePreference } from '@/hooks/useVoicePreference';

interface ComplaintAudioOverviewPlayerProps {
  complaintId: string;
  audioOverviewUrl?: string;
  audioOverviewText?: string;
  audioOverviewDuration?: number;
  onRegenerateAudio?: (voiceProvider?: string, voiceId?: string, updatedText?: string) => void;
  className?: string;
}

export const ComplaintAudioOverviewPlayer = ({ 
  complaintId, 
  audioOverviewUrl,
  audioOverviewText,
  audioOverviewDuration,
  onRegenerateAudio,
  className = ""
}: ComplaintAudioOverviewPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    const saved = localStorage.getItem('complaintAudioPlaybackSpeed');
    return saved ? parseFloat(saved) : 1;
  });
  const [showTranscript, setShowTranscript] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState(audioOverviewText || "");
  const { voiceConfig } = useVoicePreference();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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
         const res = await fetch(audioOverviewUrl, { cache: 'no-store' });
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
        setCurrentTime(0);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      });
      
      audioRef.current.addEventListener('error', (e) => {
        console.error('❌ Audio playback error:', e);
        console.error('Audio URL (blob):', audioObjectUrlRef.current);
        toast.error('Failed to play audio - check console for details');
        setIsPlaying(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      });

      audioRef.current.addEventListener('loadedmetadata', () => {
        if (audioRef.current) {
          setDuration(audioRef.current.duration);
        }
      });

      // Smooth animation frame-based time updates
      const updateTime = () => {
        if (audioRef.current && !isSeeking) {
          setCurrentTime(audioRef.current.currentTime);
        }
        if (isPlaying) {
          animationFrameRef.current = requestAnimationFrame(updateTime);
        }
      };
      animationFrameRef.current = requestAnimationFrame(updateTime);

      // Set up audio element with zero volume initially
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

      // Start playback at zero volume
      console.log('▶️ Playing complaint audio');
      await audioRef.current.play();
      setIsPlaying(true);
      
      // Fade in volume smoothly
      const fadeInVolume = (audio: HTMLAudioElement, targetVolume: number, durationMs: number) => {
        const startVolume = 0;
        const startTime = Date.now();
        const fadeInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          if (elapsed >= durationMs) {
            audio.volume = targetVolume;
            clearInterval(fadeInterval);
          } else {
            audio.volume = startVolume + (targetVolume - startVolume) * (elapsed / durationMs);
          }
        }, 20);
      };
      fadeInVolume(audioRef.current, 1, 400);
    } catch (error: any) {
      console.error('❌ Play error:', error);
      toast.error(`Playback error: ${error.message}`);
      setIsPlaying(false);
    }
  };

  const handleRegenerateAudio = async (customText?: string) => {
    if (!onRegenerateAudio) return;
    
    setIsGeneratingAudio(true);
    try {
      await onRegenerateAudio(voiceConfig.provider, voiceConfig.voiceId, customText);
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

  const handleSaveTranscript = async () => {
    if (editedTranscript.trim() !== audioOverviewText?.trim()) {
      await handleRegenerateAudio(editedTranscript);
      toast.success('Transcript saved and audio regenerated');
    }
    setIsEditingTranscript(false);
  };

  const handleCancelEdit = () => {
    setEditedTranscript(audioOverviewText || "");
    setIsEditingTranscript(false);
  };

  // Update edited transcript when prop changes
  useEffect(() => {
    if (!isEditingTranscript) {
      setEditedTranscript(audioOverviewText || "");
    }
  }, [audioOverviewText, isEditingTranscript]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
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
       const res = await fetch(audioOverviewUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `complaint-summary-${complaintId}.mp3`;
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
    localStorage.setItem('complaintAudioPlaybackSpeed', speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speedValue;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (value: number[]) => {
    setCurrentTime(value[0]);
    setIsSeeking(true);
  };

  const handleSeekEnd = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
    }
    setIsSeeking(false);
  };

  const totalDuration = duration || audioOverviewDuration || 0;

  return (
    <div className={className}>
      {audioOverviewUrl && (
        <div className="flex items-center gap-3">
          <Button
            onClick={handlePlayAudio}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 shrink-0"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          
          <div className="flex-1 max-w-[50%] space-y-1">
            <Slider
              value={[currentTime]}
              max={totalDuration}
              step={0.01}
              onValueChange={handleSeek}
              onValueCommit={handleSeekEnd}
              className="w-full"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(totalDuration)}</span>
            </div>
          </div>

          <span className="text-sm text-muted-foreground">Speed:</span>
          <Select value={playbackSpeed.toString()} onValueChange={handleSpeedChange}>
            <SelectTrigger className="h-8 w-16 text-xs">
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
            onClick={handleDownloadAudio}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      )}

      {onRegenerateAudio && !audioOverviewUrl && (
        <div className="flex justify-end mt-2">
          <Button
            onClick={() => handleRegenerateAudio()}
            variant="ghost"
            size="sm"
            className="h-8 px-3"
            disabled={isGeneratingAudio}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isGeneratingAudio ? 'animate-spin' : ''}`} />
            {isGeneratingAudio ? 'Generating...' : 'Generate'}
          </Button>
        </div>
      )}
      {!audioOverviewUrl && !isGeneratingAudio && (
        <p className="text-sm text-muted-foreground">
          Generate a 1-2 minute executive audio summary for management and partners
        </p>
      )}
      
      {audioOverviewText && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <Button
              onClick={() => setShowTranscript(!showTranscript)}
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
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
            {showTranscript && !isEditingTranscript && (
              <Button
                onClick={() => setIsEditingTranscript(true)}
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
              >
                Edit
              </Button>
            )}
          </div>
          {showTranscript && (
            <div className="p-3 bg-muted/30 rounded-md border border-border/50">
              {isEditingTranscript ? (
                <div className="space-y-2">
                  <textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    className="w-full min-h-[150px] p-2 text-sm bg-background border border-border rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter transcript text..."
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      onClick={handleCancelEdit}
                      variant="outline"
                      size="sm"
                      className="h-8"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveTranscript}
                      size="sm"
                      className="h-8"
                      disabled={isGeneratingAudio || !editedTranscript.trim()}
                    >
                      {isGeneratingAudio ? 'Regenerating...' : 'Save & Regenerate'}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {audioOverviewText}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
