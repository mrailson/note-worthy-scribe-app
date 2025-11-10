import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { playoutSilentPreRoll, fadeInVolume, audioFocusManager } from '@/utils/AudioFocusManager';

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
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const audioBlobRef = useRef<Blob | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Web Audio fallback
  const webAudioCtxRef = useRef<AudioContext | null>(null);
  const webAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const webAudioGainRef = useRef<GainNode | null>(null);
  const webStartTimeRef = useRef<number | null>(null);
  const usingWebAudioRef = useRef(false);

  // Stop any active Web Audio playback
  const stopWebAudio = () => {
    try {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (webAudioSourceRef.current) {
        webAudioSourceRef.current.onended = null as any;
        webAudioSourceRef.current.stop(0);
        webAudioSourceRef.current.disconnect();
        webAudioSourceRef.current = null;
      }
    } catch (e) {
      console.warn('WebAudio stop error (non-fatal):', e);
    }
  };

  // Play via Web Audio API (robust path)
  const playViaWebAudio = async () => {
    if (!audioBlobRef.current) return;

    if (!webAudioCtxRef.current) {
      webAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
    }

    const ctx = webAudioCtxRef.current;
    await ctx.resume();

    const arrayBuffer = await audioBlobRef.current.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.7);

    source.connect(gain).connect(ctx.destination);

    usingWebAudioRef.current = true;
    webAudioSourceRef.current = source;
    webAudioGainRef.current = gain;
    webStartTimeRef.current = ctx.currentTime;

    source.onended = async () => {
      usingWebAudioRef.current = false;
      stopWebAudio();
      setIsPlaying(false);
      setCurrentTime(0);
      await audioFocusManager.resumeAll();
    };

    source.start(0, 0);
    setIsPlaying(true);

    // Animate current time for UI
    const update = () => {
      if (!usingWebAudioRef.current || !webAudioCtxRef.current || !webStartTimeRef.current) return;
      const elapsed = webAudioCtxRef.current.currentTime - webStartTimeRef.current;
      setCurrentTime(Math.min(elapsed, audioBuffer.duration));
      animationFrameRef.current = requestAnimationFrame(update);
    };
    animationFrameRef.current = requestAnimationFrame(update);
  };

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
        setBufferedEnd(0);
        const res = await fetch(audioUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        
        audioBlobRef.current = blob;
        
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
            setIsBuffering(false);
          };

          audioRef.current.onprogress = () => {
            if (audioRef.current?.buffered.length) {
              setBufferedEnd(audioRef.current.buffered.end(audioRef.current.buffered.length - 1));
            }
          };
          
          // Wait for canplaythrough
          await new Promise<void>(async (resolve) => {
            const onReady = () => resolve();
            audioRef.current?.addEventListener('canplaythrough', onReady, { once: true });
          });
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

  const handlePlayPause = async () => {
    if (!audioUrl) {
      toast.info('Audio Summary Demo', {
        description: 'This is a demonstration feature. In production, AI-generated audio summaries would play here.',
      });
      return;
    }
    
    if (isPlaying) {
      if (usingWebAudioRef.current) {
        stopWebAudio();
        await audioFocusManager.resumeAll();
      } else if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }
    
    // Check if audio is ready to play
    if (audioRef.current && audioRef.current.readyState < 3) {
      toast.info('Audio is still loading, please wait...');
      return;
    }

    // Check for buffering issues - if buffer doesn't start near 0, use Web Audio fallback
    let bufferedStart = 0;
    try {
      const br = audioRef.current?.buffered;
      if (br && br.length) bufferedStart = br.start(0);
    } catch {}
    
    if (bufferedStart > 0.05 && audioBlobRef.current) {
      console.log(`⚠️ Buffered start at ${bufferedStart.toFixed(2)}s – using Web Audio fallback.`);
      try {
        await audioFocusManager.pauseAll('complaint_summary_playback');
        await playoutSilentPreRoll(500);
        await playViaWebAudio();
      } catch (error) {
        console.error('Web Audio playback error:', error);
        toast.error('Audio playback failed. Please try again.');
        await audioFocusManager.resumeAll();
      }
      return;
    }

    // Standard HTMLAudioElement playback
    const minBuffer = Math.min(5, effectiveDuration * 0.2);
    if (bufferedEnd < minBuffer) {
      toast.info('Audio still buffering, please wait...');
      return;
    }

    try {
      await audioFocusManager.pauseAll('complaint_summary_playback');
      await playoutSilentPreRoll(500);
      
      if (audioRef.current) {
        audioRef.current.volume = 0;
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
        setIsPlaying(true);
        fadeInVolume(audioRef.current, 1.0, 700);
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      toast.error('Audio playback failed. Please try again.');
      setIsPlaying(false);
      await audioFocusManager.resumeAll();
    }
  };

  const handleSliderChange = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    if (audioRef.current) {
      // Clamp seek to avoid INDEX_SIZE_ERR on very short files
      const clampedTime = Math.min(newTime, (audioRef.current.duration || effectiveDuration) - 0.001);
      audioRef.current.currentTime = Math.max(0, clampedTime);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = async () => {
    setIsPlaying(false);
    setCurrentTime(0);
    // Resume microphones after playback
    await audioFocusManager.resumeAll();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWebAudio();
      audioFocusManager.resumeAll();
    };
  }, []);

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
