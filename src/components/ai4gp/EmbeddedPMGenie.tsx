import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useConversation } from '@11labs/react';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Loader2, Sparkles, Volume2, VolumeX, Mic, MicOff, Mail, Image } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { playoutSilentPreRoll, fadeInVolume } from '@/utils/AudioFocusManager';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import wakeRing from '@/assets/sounds/uk_phone_ring_two_rings.wav';

interface EmbeddedPMGenieProps {
  onClose: () => void;
}

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export const EmbeddedPMGenie = ({ onClose }: EmbeddedPMGenieProps) => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { practiceContext } = usePracticeContext();
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [emailsSent, setEmailsSent] = useState(0);
  const [infographicsGenerated, setInfographicsGenerated] = useState(0);
  const wakeAudioRef = useRef<HTMLAudioElement | null>(null);
  const volumeGuardTimerRef = useRef<number | null>(null);
  const prevVolumeRef = useRef(0.8);

  // Get user's display name, email and practice
  const userDisplayName = profile?.full_name || profile?.display_name || user?.email?.split('@')[0] || 'User';
  const userEmail = profile?.email || user?.email;
  const practiceName = practiceContext?.practiceName || practiceContext?.pcnName;
  const userTitle = profile?.title || profile?.role;

  // Build dynamic prompt with user context for the agent
  const dynamicPrompt = useMemo(() => {
    const parts: string[] = [];
    
    parts.push(`You are speaking with ${userDisplayName}.`);
    
    if (userTitle) {
      parts.push(`Their role is ${userTitle}.`);
    }
    
    if (practiceName) {
      parts.push(`They work at ${practiceName}.`);
    }
    
    if (userEmail) {
      parts.push(`Their email address is ${userEmail} - you already know this, so NEVER ask for their email. When they ask you to email them something, use this email address directly.`);
    }
    
    parts.push(`You can send emails using the send_email tool and create infographics using the generate_infographic tool.`);
    parts.push(`When generating infographics, you can also offer to email them the result.`);
    
    return parts.join(' ');
  }, [userDisplayName, userEmail, practiceName, userTitle]);

  // Email sending function for client tool
  const sendEmailToUser = async (params: { subject: string; content: string }) => {
    if (!userEmail) {
      toast.error('No email address found');
      return 'Failed to send email: No email address configured in your profile';
    }

    try {
      console.log('📧 PM Genie sending email to:', userEmail);
      
      const { data, error } = await supabase.functions.invoke('pm-genie-send-email', {
        body: {
          subject: params.subject,
          content: params.content,
          userEmail: userEmail
        }
      });

      if (error) {
        console.error('Email send error:', error);
        toast.error('Failed to send email');
        return 'Failed to send email: ' + error.message;
      }

      if (data?.success) {
        setEmailsSent(prev => prev + 1);
        toast.success('Email sent successfully!', {
          description: `Check your inbox at ${userEmail}`
        });
        return `Email sent successfully to ${userEmail}`;
      } else {
        toast.error('Failed to send email');
        return 'Failed to send email: ' + (data?.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Email send exception:', err);
      toast.error('Failed to send email');
      return 'Failed to send email: ' + err.message;
    }
  };

  // Infographic generation function for client tool
  // Note: ElevenLabs sends keyPoints as a string (comma-separated), not array
  const generateInfographic = async (params: { topic: string; keyPoints?: string }) => {
    try {
      console.log('🎨 PM Genie generating infographic:', params.topic, 'keyPoints:', params.keyPoints);
      toast.info('Generating infographic...', { duration: 15000 });

      // Parse keyPoints - could be comma-separated string from ElevenLabs
      let keyMessages: string[] = [];
      if (params.keyPoints) {
        if (typeof params.keyPoints === 'string') {
          keyMessages = params.keyPoints.split(',').map(k => k.trim()).filter(k => k);
        } else if (Array.isArray(params.keyPoints)) {
          keyMessages = params.keyPoints;
        }
      }

      const { data, error } = await supabase.functions.invoke('ai4gp-image-generation', {
        body: {
          prompt: params.topic,
          requestType: 'infographic',
          layoutPreference: 'landscape',
          targetAudience: 'staff',
          isStudioRequest: true,
          keyMessages: keyMessages,
          brandingLevel: 'none'
        }
      });

      if (error) {
        console.error('Infographic generation error:', error);
        toast.error('Failed to generate infographic');
        return 'Failed to generate infographic: ' + error.message;
      }

      if (data?.imageUrl) {
        setInfographicsGenerated(prev => prev + 1);
        toast.success('Infographic generated!');
        
        // Return URL for the agent to potentially email
        return `Infographic generated successfully. The image URL is: ${data.imageUrl}. You can now offer to email this to the user.`;
      } else {
        toast.error('Failed to generate infographic');
        return 'Failed to generate infographic: No image returned';
      }
    } catch (err: any) {
      console.error('Infographic generation exception:', err);
      toast.error('Failed to generate infographic');
      return 'Failed to generate infographic: ' + err.message;
    }
  };

  const conversation = useConversation({
    clientTools: {
      send_email: async (params: { subject: string; content: string }) => {
        return await sendEmailToUser(params);
      },
      generate_infographic: async (params: { topic: string; keyPoints?: string }) => {
        return await generateInfographic(params);
      }
    },
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

      // Start the session with dynamic user context
      console.log('🎯 Starting PM Genie with user context:', { userDisplayName, userEmail, practiceName });
      
      await conversation.startSession({
        agentId: 'agent_01jzsg04q1fwy9bfydkhszan7s',
        signedUrl: data.signed_url,
        dynamicVariables: {
          user_name: userDisplayName,
          user_email: userEmail || '',
          practice_name: practiceName || '',
          user_title: userTitle || ''
        }
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
            {status === 'connected' && `Hi ${userDisplayName.split(' ')[0]}! Ask me anything — I can email you content or create infographics.`}
            {status === 'disconnected' && 'The conversation has ended'}
            {status === 'error' && (error || 'Please try again')}
          </p>
          
          {/* User context indicator */}
          {status === 'connected' && userEmail && (
            <p className="text-xs text-muted-foreground mt-1">
              Emails will be sent to {userEmail}
            </p>
          )}
          
          {/* Activity indicators */}
          {(emailsSent > 0 || infographicsGenerated > 0) && (
            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-primary">
              {emailsSent > 0 && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{emailsSent} email{emailsSent !== 1 ? 's' : ''} sent</span>
                </div>
              )}
              {infographicsGenerated > 0 && (
                <div className="flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5" />
                  <span>{infographicsGenerated} infographic{infographicsGenerated !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          )}
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
