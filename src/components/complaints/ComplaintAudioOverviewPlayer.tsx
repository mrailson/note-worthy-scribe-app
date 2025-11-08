import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, RefreshCw, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { showToast } from '@/utils/toastWrapper';
import { useVoicePreference } from '@/hooks/useVoicePreference';
import { playoutSilentPreRoll, fadeInVolume } from '@/utils/AudioFocusManager';

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
  const didWarmUpRef = useRef(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferedEnd, setBufferedEnd] = useState(0);

  const handlePlayAudio = async () => {
    if (!audioOverviewUrl) {
      console.log('❌ No audio URL available');
      showToast.error('No audio URL available', { section: 'complaints' });
      return;
    }

    try {
      if (audioRef.current && isPlaying) {
        console.log('⏸️ Pausing audio');
        audioRef.current.pause();
        setIsPlaying(false);
        return;
      }

      // Audio should already be preloaded, just play it
      if (audioRef.current && audioRef.current.readyState >= 3) {
        console.log('▶️ Playing preloaded audio');
        
        // Warm up audio device on first play to prevent cut-offs
        if (!didWarmUpRef.current) {
          await playoutSilentPreRoll(300);
          didWarmUpRef.current = true;
        }
        
        audioRef.current.currentTime = 0;
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
          showToast.error('Failed to play audio - check console for details', { section: 'complaints' });
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

        const updateTime = () => {
          if (audioRef.current && !isSeeking && audioRef.current.paused === false) {
            setCurrentTime(audioRef.current.currentTime);
            animationFrameRef.current = requestAnimationFrame(updateTime);
          }
        };
        
        // Start silent and fade in to prevent initial glitches
        audioRef.current.volume = 0;
        await audioRef.current.play();
        fadeInVolume(audioRef.current, 1, 500);
        
        setIsPlaying(true);
        animationFrameRef.current = requestAnimationFrame(updateTime);
      } else {
        showToast.error('Audio is still loading, please wait...', { section: 'complaints' });
      }
    } catch (error: any) {
      console.error('❌ Play error:', error);
      showToast.error(`Playback error: ${error.message}`, { section: 'complaints' });
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
      showToast.success('Transcript saved and audio regenerated', { section: 'complaints' });
    }
    setIsEditingTranscript(false);
  };

  const handleCancelEdit = () => {
    setEditedTranscript(audioOverviewText || "");
    setIsEditingTranscript(false);
  };

  // Update buffered progress
  const updateBuffered = () => {
    const a = audioRef.current;
    if (!a || !a.duration || !isFinite(a.duration)) return;
    const br = a.buffered;
    if (br && br.length) {
      setBufferedEnd(br.end(br.length - 1));
    }
  };

  // Preload audio in the background when URL changes
  useEffect(() => {
    const preloadAudio = async () => {
      if (!audioOverviewUrl) return;
      
      try {
        setIsBuffering(true);
        setBufferedEnd(0);
        console.log('🔄 Preloading audio in background...');
        
        // Download and create blob URL if needed
        if (sourceUrlRef.current !== audioOverviewUrl || !audioObjectUrlRef.current) {
          const res = await fetch(audioOverviewUrl, { cache: 'no-store' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          
          if (audioObjectUrlRef.current) {
            URL.revokeObjectURL(audioObjectUrlRef.current);
          }
          audioObjectUrlRef.current = URL.createObjectURL(blob);
          sourceUrlRef.current = audioOverviewUrl;
        }

        // Clean up existing audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.removeEventListener('ended', () => {});
          audioRef.current.removeEventListener('error', () => {});
          audioRef.current.removeEventListener('progress', updateBuffered);
          audioRef.current.removeEventListener('loadedmetadata', updateBuffered);
          audioRef.current.removeEventListener('canplaythrough', updateBuffered);
          audioRef.current = null;
        }

        // Create and preload new audio
        audioRef.current = new Audio();
        audioRef.current.preload = 'auto';
        audioRef.current.playbackRate = playbackSpeed;
        audioRef.current.src = audioObjectUrlRef.current;
        
        audioRef.current.addEventListener('ended', () => {
          setIsPlaying(false);
          setCurrentTime(0);
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
        });
        
        audioRef.current.addEventListener('error', (e) => {
          console.error('❌ Audio preload error:', e);
          setIsBuffering(false);
        });

        audioRef.current.addEventListener('loadedmetadata', () => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration);
            updateBuffered();
          }
        });

        audioRef.current.addEventListener('progress', updateBuffered);
        audioRef.current.addEventListener('canplaythrough', updateBuffered);

        // Wait for audio to be buffered
        await new Promise<void>((resolve) => {
          const onCanPlayThrough = () => {
            console.log('✅ Audio preloaded and ready');
            updateBuffered();
            setIsBuffering(false);
            resolve();
          };
          audioRef.current?.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
        });
      } catch (error) {
        console.error('❌ Preload error:', error);
        setIsBuffering(false);
      }
    };

    preloadAudio();
  }, [audioOverviewUrl, playbackSpeed]);

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
      showToast.error('No audio available to download', { section: 'complaints' });
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
      showToast.success('Audio downloaded', { section: 'complaints' });
    } catch (error: any) {
      console.error('❌ Download error:', error);
      showToast.error(`Download failed: ${error.message}`, { section: 'complaints' });
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
            disabled={isBuffering}
          >
            {isBuffering ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          
          <div className="flex-1 max-w-[50%] space-y-1">
            <div className="relative w-full">
              {/* Buffered progress indicator */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2.5 rounded-full bg-secondary/30 border border-border/30 pointer-events-none">
                <div
                  className="h-full rounded-full bg-primary/20 transition-[width] duration-200"
                  style={{ width: `${Math.max(0, Math.min(100, totalDuration ? (bufferedEnd / totalDuration) * 100 : 0))}%` }}
                />
              </div>
              <Slider
                value={[currentTime]}
                max={totalDuration}
                step={0.01}
                onValueChange={handleSeek}
                onValueCommit={handleSeekEnd}
                className={`relative w-full ${isBuffering ? 'opacity-50 pointer-events-none' : ''}`}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatDuration(currentTime)}</span>
              {isBuffering ? (
                <span className="text-primary animate-pulse">⏳ Loading audio...</span>
              ) : audioRef.current?.readyState >= 3 && bufferedEnd >= totalDuration * 0.95 ? (
                <span className="text-green-600">✓ Ready</span>
              ) : null}
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
      
      {/* AI Critical Friend Review button - shown after audio is generated */}
      {audioOverviewUrl && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-2">
            Want a thorough review? Start a voice conversation with our AI assistant to critically discuss this complaint.
          </p>
        </div>
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
              <>
                <Button
                  onClick={() => setIsEditingTranscript(true)}
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                >
                  Edit
                </Button>
                {onRegenerateAudio && (
                  <Button
                    onClick={() => handleRegenerateAudio()}
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    disabled={isGeneratingAudio}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${isGeneratingAudio ? 'animate-spin' : ''}`} />
                    Regenerate
                  </Button>
                )}
              </>
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
