/**
 * NRESWidgetLoader.tsx — Fixed version
 *
 * Previously used the bare <elevenlabs-convai> HTML web component which has no
 * lifecycle callbacks, so the email hook (useNRESSummaryEmail) was never called.
 *
 * Now uses useConversation from @11labs/react (same pattern as EmbeddedPMGenie)
 * so we get onConnect / onDisconnect / onMessage and can:
 *  - buffer the transcript
 *  - send a session summary email on disconnect via send-genie-transcript-email
 */

import { useState, useRef, useEffect } from 'react';
import { useConversation } from '@11labs/react';
import { Loader2, Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVoiceAgentContext } from '@/hooks/useVoiceAgentContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// ── Agent IDs ──────────────────────────────────────────────────────────────────
const NRES_AGENT_ID = 'agent_7801knyxsxcxehsr8kynxgxz6xyr';
const ENN_AGENT_ID  = 'agent_6801kp1qmxn1f24b42407nn2gq57';

type Status = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface ConversationEntry {
  role: string;
  message: string;
  timestamp: string;
}

// ── Shared email sender ────────────────────────────────────────────────────────
async function sendTranscriptEmail(
  userEmail: string,
  conversationBuffer: ConversationEntry[],
  conversationId: string | null,
  neighbourhoodName: string,
  userContext: Record<string, string | undefined>,
) {
  if (!userEmail || conversationBuffer.length === 0) return;

  const serviceType  = neighbourhoodName === 'ENN' ? 'enn-agent' : 'nres-agent';
  const serviceName  = `${neighbourhoodName} Voice Agent`;

  try {
    const { error } = await supabase.functions.invoke('send-genie-transcript-email', {
      body: {
        userEmail,
        serviceName,
        conversationBuffer,
        conversationId,
        serviceType,
        userContext,
      },
    });

    if (error) throw error;

    toast.success('Session summary emailed', {
      description: `Transcript sent to ${userEmail}`,
    });
  } catch (err) {
    console.error(`[${neighbourhoodName}Widget] Transcript email failed:`, err);
    toast.error('Email failed', {
      description: 'Session saved but transcript email could not be sent.',
    });
  }
}

// ── Main component ─────────────────────────────────────────────────────────────
export const NRESWidgetEmbed = ({
  neighbourhoodName = 'NRES',
}: {
  neighbourhoodName?: string;
}) => {
  const agentId = neighbourhoodName === 'ENN' ? ENN_AGENT_ID : NRES_AGENT_ID;
  const { user }                   = useAuth();
  const { contextData, contextPrompt } = useVoiceAgentContext();

  const [status,    setStatus]    = useState<Status>('idle');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Refs that stay fresh inside ElevenLabs callbacks
  const emailRef       = useRef<string | undefined>(undefined);
  const nameRef        = useRef<string>('User');
  const practiceRef    = useRef<string | undefined>(undefined);
  const bufferRef      = useRef<ConversationEntry[]>([]);
  const convIdRef      = useRef<string | null>(null);
  const startTimeRef   = useRef<string | null>(null);
  const ctxRef         = useRef(contextData);

  // Keep refs in sync when context loads
  useEffect(() => {
    emailRef.current    = contextData.email || user?.email;
    nameRef.current     = contextData.displayName || user?.email?.split('@')[0] || 'User';
    practiceRef.current = contextData.practiceName;
    ctxRef.current      = contextData;
  }, [contextData, user?.email]);

  // ── useConversation ──────────────────────────────────────────────────────────
  const conversation = useConversation({
    onConnect: () => {
      console.log(`[${neighbourhoodName}Widget] Connected`);
      setStatus('connected');
      setError(null);
      bufferRef.current  = [];
      startTimeRef.current = new Date().toISOString();
    },

    onDisconnect: async () => {
      console.log(`[${neighbourhoodName}Widget] Disconnected — buffered ${bufferRef.current.length} messages`);
      setStatus('disconnected');

      const email  = emailRef.current;
      const buffer = bufferRef.current;

      if (email && buffer.length > 0) {
        const ctx = ctxRef.current;
        await sendTranscriptEmail(
          email,
          buffer,
          convIdRef.current,
          neighbourhoodName,
          {
            displayName:      ctx.displayName,
            role:             ctx.role,
            practiceName:     ctx.practiceName,
            practiceAddress:  ctx.practiceAddress,
            practicePostcode: ctx.practicePostcode,
            practicePhone:    ctx.practicePhone,
            practiceOdsCode:  ctx.practiceOdsCode,
          },
        );
      } else if (!email) {
        console.warn(`[${neighbourhoodName}Widget] No email — transcript not sent`);
      }

      convIdRef.current  = null;
      bufferRef.current  = [];
    },

    onMessage: (message) => {
      // Capture text turns for the transcript
      if (message.message && message.source) {
        const role = message.source === 'ai' ? 'assistant' : 'user';
        const last = bufferRef.current[bufferRef.current.length - 1];
        // Deduplicate consecutive identical entries
        if (!last || last.message !== message.message || last.role !== role) {
          bufferRef.current.push({
            role,
            message: message.message,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Capture the ElevenLabs conversation ID for reference
      if (
        (message as any).type === 'conversation_initiation_metadata' &&
        (message as any).conversation_id
      ) {
        convIdRef.current = (message as any).conversation_id;
      }
    },

    onError: (err) => {
      console.error(`[${neighbourhoodName}Widget] Error:`, err);
      setStatus('error');
      setError(typeof err === 'string' ? err : 'Connection error');
    },
  });

  // ── Start session ────────────────────────────────────────────────────────────
  const startConversation = async () => {
    if (status === 'connecting' || status === 'connected') return;
    setStatus('connecting');
    setError(null);

    try {
      // Get signed URL from our edge function (keeps XI_API_KEY server-side)
      const { data, error: fnError } = await supabase.functions.invoke(
        'elevenlabs-agent-url',
        { body: { agentId } },
      );

      if (fnError || !data?.signed_url) {
        throw new Error(fnError?.message || 'Failed to get signed URL');
      }

      await conversation.startSession({
        agentId,
        signedUrl: data.signed_url,
        dynamicVariables: {
          user_name:        nameRef.current,
          user_email:       emailRef.current || '',
          user_role:        contextData.role || '',
          practice_name:    practiceRef.current || '',
          practice_address: contextData.practiceAddress || '',
          practice_postcode:contextData.practicePostcode || '',
          practice_phone:   contextData.practicePhone || '',
          practice_ods_code:contextData.practiceOdsCode || '',
          neighbourhood:    neighbourhoodName,
          dynamic_context:  contextPrompt,
        },
      });
    } catch (err: any) {
      console.error(`[${neighbourhoodName}Widget] Start failed:`, err);
      setStatus('error');
      setError(err?.message || 'Failed to connect');
      toast.error(`Failed to start ${neighbourhoodName} agent`);
    }
  };

  // ── End session ──────────────────────────────────────────────────────────────
  const endConversation = async () => {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error(`[${neighbourhoodName}Widget] End session error:`, err);
    }
  };

  // Tidy up on unmount
  useEffect(() => {
    return () => {
      conversation.endSession().catch(() => {});
    };
  }, []);

  // Toggle mic mute
  const toggleMic = async () => {
    try {
      if (isMicMuted) {
        await (conversation as any).unmute?.();
      } else {
        await (conversation as any).mute?.();
      }
      setIsMicMuted(v => !v);
    } catch {
      /* not all versions support mute */
    }
  };

  // ── UI ───────────────────────────────────────────────────────────────────────
  const label = neighbourhoodName === 'ENN' ? 'ENN Agent' : 'NRES Agent';
  const accentColour = neighbourhoodName === 'ENN' ? '#7C3AED' : '#005EB8';

  return (
    <div className="mt-3 pt-3 border-t border-slate-200">
      <div className="flex items-center gap-3 flex-wrap">

        {/* Status orb */}
        <div className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300',
          status === 'idle'         && 'bg-slate-100',
          status === 'connecting'   && 'bg-amber-100 animate-pulse',
          status === 'connected'    && 'bg-green-100',
          status === 'disconnected' && 'bg-slate-100',
          status === 'error'        && 'bg-red-100',
        )}>
          {status === 'connecting' && <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />}
          {status === 'connected'  && <Phone   className="w-4 h-4 text-green-600" />}
          {status === 'error'      && <PhoneOff className="w-4 h-4 text-red-500" />}
          {(status === 'idle' || status === 'disconnected') && (
            <span style={{ color: accentColour }} className="text-sm font-bold">🎙</span>
          )}
        </div>

        {/* Label + status text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-700 leading-tight">{label}</p>
          <p className="text-xs text-slate-400 leading-tight">
            {status === 'idle'         && 'Click to start voice session'}
            {status === 'connecting'   && 'Connecting…'}
            {status === 'connected'    && 'Live — transcript will be emailed when you end the call'}
            {status === 'disconnected' && 'Session ended — check your email for the transcript'}
            {status === 'error'        && (error || 'Connection failed — try again')}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {status === 'connected' && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={toggleMic}
              title={isMicMuted ? 'Unmute mic' : 'Mute mic'}
            >
              {isMicMuted
                ? <MicOff className="w-3.5 h-3.5 text-red-500" />
                : <Mic    className="w-3.5 h-3.5" />
              }
            </Button>
          )}

          {(status === 'idle' || status === 'disconnected' || status === 'error') && (
            <Button
              size="sm"
              className="h-8 text-xs font-semibold text-white"
              style={{ background: accentColour }}
              onClick={startConversation}
            >
              <Phone className="w-3 h-3 mr-1" />
              Start
            </Button>
          )}

          {(status === 'connected' || status === 'connecting') && (
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs font-semibold"
              onClick={endConversation}
            >
              <PhoneOff className="w-3 h-3 mr-1" />
              End call
            </Button>
          )}
        </div>
      </div>

      {/* No email warning */}
      {!emailRef.current && status === 'idle' && (
        <p className="mt-2 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          ⚠️ No email address found in your profile — transcript cannot be emailed.
          Please update your Notewell profile.
        </p>
      )}
    </div>
  );
};
