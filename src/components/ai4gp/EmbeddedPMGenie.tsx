import React, { useState, useEffect, useRef } from 'react';
import { useConversation } from '@11labs/react';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Loader2, Sparkles, Volume2, VolumeX, Mic, MicOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { playoutSilentPreRoll, fadeInVolume } from '@/utils/AudioFocusManager';
import wakeRing from '@/assets/sounds/uk_phone_ring_two_rings.wav';

interface EmbeddedPMGenieProps {
  onClose: () => void;
}

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export const EmbeddedPMGenie = ({ onClose }: EmbeddedPMGenieProps) => {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const wakeAudioRef = useRef<HTMLAudioElement | null>(null);
  const volumeGuardTimerRef = useRef<number | null>(null);
  const prevVolumeRef = useRef(0.8);

  const conversation = useConversation({
    onConnect: async () => {
      console.log('Connected to PM Genie');
      setStatus('connected');
      setError(null);
      toast.success('Connected to PM Genie');

      // Warm up output device with silent pre-roll
      try {
        await playoutSilentPreRoll(600);
      } catch (err) {
        console.warn('Silent pre-roll failed:', err);
      }

      // Ensure audible volume during first 3s after connect
      try {
        const startTs = performance.now();
        volumeGuardTimerRef.current = window.setInterval(async () => {
          if (conversation.status === 'connected' && !isMuted) {
            try {
              await conversation.setVolume({ volume });
            } catch {}
          }
          if (performance.now() - startTs > 3000 && volumeGuardTimerRef.current) {
            clearInterval(volumeGuardTimerRef.current);
            volumeGuardTimerRef.current = null;
          }
        }, 250);
      } catch (e) {
        console.warn('Volume guard setup failed:', e);
      }
    },
    onDisconnect: () => {
      console.log('Disconnected from PM Genie');
      setStatus('disconnected');
      toast.info('Disconnected from PM Genie');

      if (volumeGuardTimerRef.current) {
        clearInterval(volumeGuardTimerRef.current);
        volumeGuardTimerRef.current = null;
      }
    },
    onMessage: (message) => {
      console.log('PM Genie message:', message);
    },
    onError: (error) => {
      console.error('PM Genie error:', error);
      setError(typeof error === 'string' ? error : 'Connection error occurred');
      setStatus('error');
      toast.error('Connection error');
    }
  });

  // Play wake sound before connecting
  const playWakeSound = async () => {
    try {
      if (!wakeAudioRef.current) {
        const a = new Audio(wakeRing);
        a.preload = 'auto';
        a.loop = false;
        (a as any).playsInline = true;
        a.crossOrigin = 'anonymous';
        wakeAudioRef.current = a;
      }
      const audio = wakeAudioRef.current;
      audio.currentTime = 0;
      audio.volume = Math.min(Math.max(volume, 0.2), 0.5);
      const playPromise = audio.play();
      if (playPromise) await playPromise;
      try { fadeInVolume(audio, audio.volume, 250); } catch {}
      await new Promise<void>((resolve) => {
        audio.addEventListener('ended', () => resolve(), { once: true });
      });
    } catch (err) {
      console.warn('Wake ring failed, falling back to silent pre-roll', err);
      await playoutSilentPreRoll(600);
    }
  };

  // Start conversation
  const startConversation = async () => {
    setStatus('connecting');
    setError(null);

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('Microphone permission denied:', err);
      setError('Microphone access is required');
      setStatus('error');
      toast.error('Microphone access denied');
      return;
    }

    try {
      // Play wake sound
      await playWakeSound();

      // Get signed URL for PM Genie agent
      const { data, error: urlError } = await supabase.functions.invoke('elevenlabs-agent-url', {
        body: { agentId: 'agent_01jzsg04q1fwy9bfydkhszan7s' } // PM Genie agent ID
      });

      if (urlError) throw urlError;

      // Silent pre-roll before session
      try {
        await playoutSilentPreRoll(800);
      } catch (e) {
        console.warn('Silent pre-roll failed', e);
      }

      // Start the session
      await conversation.startSession({
        agentId: 'agent_01jzsg04q1fwy9bfydkhszan7s',
        signedUrl: data.signed_url
      });

      // Volume kick after start
      try {
        await conversation.setVolume({ volume: 0 });
        await new Promise(r => setTimeout(r, 60));
        await conversation.setVolume({ volume });
      } catch (e) {
        console.warn('Volume kick failed:', e);
      }

    } catch (err: any) {
      console.error('Failed to start PM Genie:', err);
      setError('Failed to connect to PM Genie');
      setStatus('error');
      toast.error('Failed to start PM Genie');
    }
  };

  // End conversation
  const endConversation = async () => {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error('Error ending session:', err);
    }
    setStatus('disconnected');
  };

  // Toggle mute
  const toggleMute = async () => {
    if (isMuted) {
      await conversation.setVolume({ volume: prevVolumeRef.current });
      setVolume(prevVolumeRef.current);
    } else {
      prevVolumeRef.current = volume;
      await conversation.setVolume({ volume: 0 });
    }
    setIsMuted(!isMuted);
  };

  // Toggle mic mute
  const toggleMicMute = async () => {
    try {
      if (isMicMuted) {
        await (conversation as any).unmute?.();
      } else {
        await (conversation as any).mute?.();
      }
      setIsMicMuted(!isMicMuted);
    } catch (e) {
      console.warn('Mic mute toggle failed:', e);
    }
  };

  // Handle close - end conversation first if connected
  const handleClose = async () => {
    if (status === 'connected' || status === 'connecting') {
      await endConversation();
    }
    onClose();
  };

  // Auto-start connection on mount and cleanup on unmount
  useEffect(() => {
    startConversation();
    
    // Cleanup function - ensure we end the session when component unmounts
    return () => {
      console.log('EmbeddedPMGenie unmounting - cleaning up...');
      
      if (volumeGuardTimerRef.current) {
        clearInterval(volumeGuardTimerRef.current);
        volumeGuardTimerRef.current = null;
      }
      
      // Always try to end the session on unmount to prevent orphaned connections
      try {
        conversation.endSession().catch(err => {
          console.warn('Error ending session on unmount:', err);
        });
      } catch (err) {
        console.warn('Error ending session on unmount:', err);
      }
    };
  }, []);
  
  // Warn user before navigating away while call is active
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === 'connected' || status === 'connecting') {
        e.preventDefault();
        e.returnValue = 'You have an active voice call. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-gradient-to-b from-background to-muted/20">
      {/* Connection Status Indicator */}
      <div className="flex flex-col items-center gap-6">
        {/* Animated orb */}
        <div className={cn(
          "relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500",
          status === 'idle' && "bg-muted",
          status === 'connecting' && "bg-amber-500/20 animate-pulse",
          status === 'connected' && "bg-green-500/20",
          status === 'disconnected' && "bg-muted",
          status === 'error' && "bg-destructive/20"
        )}>
          {/* Inner glow ring for connected state */}
          {status === 'connected' && (
            <div className="absolute inset-2 rounded-full bg-green-500/10 animate-ping" />
          )}
          
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300",
            status === 'idle' && "bg-muted-foreground/10",
            status === 'connecting' && "bg-amber-500/30",
            status === 'connected' && "bg-green-500/30",
            status === 'disconnected' && "bg-muted-foreground/10",
            status === 'error' && "bg-destructive/30"
          )}>
            {status === 'connecting' ? (
              <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
            ) : status === 'connected' ? (
              <Phone className="w-10 h-10 text-green-600" />
            ) : status === 'error' ? (
              <PhoneOff className="w-10 h-10 text-destructive" />
            ) : (
              <Sparkles className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Status text */}
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-1">
            {status === 'idle' && 'PM Genie'}
            {status === 'connecting' && 'Connecting...'}
            {status === 'connected' && 'Connected to PM Genie'}
            {status === 'disconnected' && 'Call Ended'}
            {status === 'error' && 'Connection Failed'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {status === 'idle' && 'Ready to connect'}
            {status === 'connecting' && 'Establishing voice connection'}
            {status === 'connected' && 'Your PM assistant is listening'}
            {status === 'disconnected' && 'The conversation has ended'}
            {status === 'error' && (error || 'Please try again')}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mt-4">
          {status === 'connected' && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleMicMute}
                className={cn(
                  "rounded-full w-12 h-12",
                  isMicMuted && "bg-destructive/10 border-destructive text-destructive"
                )}
                title={isMicMuted ? "Unmute microphone" : "Mute microphone"}
              >
                {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>

              <Button
                variant="destructive"
                size="lg"
                onClick={endConversation}
                className="rounded-full px-8"
              >
                <PhoneOff className="w-5 h-5 mr-2" />
                End Call
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={toggleMute}
                className={cn(
                  "rounded-full w-12 h-12",
                  isMuted && "bg-muted"
                )}
                title={isMuted ? "Unmute speaker" : "Mute speaker"}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
            </>
          )}

          {status === 'disconnected' && (
            <Button
              variant="default"
              size="lg"
              onClick={startConversation}
              className="rounded-full px-8"
            >
              <Phone className="w-5 h-5 mr-2" />
              Reconnect
            </Button>
          )}

          {status === 'error' && (
            <Button
              variant="default"
              size="lg"
              onClick={startConversation}
              className="rounded-full px-8"
            >
              <Phone className="w-5 h-5 mr-2" />
              Try Again
            </Button>
          )}
        </div>

        {/* Close button - always visible but styled appropriately */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="mt-6 text-muted-foreground hover:text-foreground"
        >
          {status === 'connected' ? 'End & Close' : 'Close'}
        </Button>
      </div>
    </div>
  );
};
