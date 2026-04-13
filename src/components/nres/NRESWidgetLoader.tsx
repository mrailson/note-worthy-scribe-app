/**
 * NRESWidgetLoader.tsx — v3
 *
 * Changes from v2:
 * 1. Removed position:fixed — now renders inline inside the NRES tab card
 *    in SDAExecutiveSummary (same pattern as NRESGPAgent, NRESPMAgent etc.)
 * 2. Fixed blank email — transforms { role, message, timestamp }[] buffer into
 *    the { user, agent, timestamp }[] format expected by send-genie-transcript-email
 */

import { useState, useRef, useEffect } from 'react';
import { useConversation } from '@11labs/react';
import { Loader2, Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVoiceAgentContext } from '@/hooks/useVoiceAgentContext';
import { useAuth } from '@/contexts/AuthContext';

const NRES_AGENT_ID = 'agent_7801knyxsxcxehsr8kynxgxz6xyr';
const ENN_AGENT_ID  = 'agent_6801kp1qmxn1f24b42407nn2gq57';

type Status = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface ConversationEntry {
  role: string;      // 'user' | 'assistant'
  message: string;
  timestamp: string;
}

/**
 * Convert individual-message buffer to the paired { user, agent } format
 * expected by send-genie-transcript-email.
 * Each entry has either user OR agent populated (never both), which is fine —
 * the email function checks each field independently.
 */
function toEmailBuffer(buffer: ConversationEntry[]) {
  return buffer.map(e => ({
    user:           e.role === 'user'      ? e.message : '',
    agent:          e.role === 'assistant' ? e.message : '',
    timestamp:      e.timestamp,
    userTimestamp:  e.role === 'user'      ? e.timestamp : undefined,
    agentTimestamp: e.role === 'assistant' ? e.timestamp : undefined,
  }));
}

async function sendTranscriptEmail(
  userEmail: string,
  buffer: ConversationEntry[],
  conversationId: string | null,
  neighbourhoodName: string,
  userContext: Record<string, string | undefined>,
) {
  if (!userEmail || buffer.length === 0) return;
  try {
    const { error } = await supabase.functions.invoke('send-genie-transcript-email', {
      body: {
        userEmail,
        serviceName:       `${neighbourhoodName} Voice Agent`,
        conversationBuffer: toEmailBuffer(buffer),   // ← fixed format
        conversationId,
        serviceType:       neighbourhoodName === 'ENN' ? 'enn-agent' : 'nres-agent',
        userContext,
      },
    });
    if (error) throw error;
    toast.success('Session summary emailed', { description: `Transcript sent to ${userEmail}` });
  } catch (err) {
    console.error(`[${neighbourhoodName}Widget] Email failed:`, err);
    toast.error('Email failed', { description: 'Transcript could not be sent.' });
  }
}

export const NRESWidgetEmbed = ({
  neighbourhoodName = 'NRES',
}: {
  neighbourhoodName?: string;
}) => {
  const agentId      = neighbourhoodName === 'ENN' ? ENN_AGENT_ID : NRES_AGENT_ID;
  const accentColour = neighbourhoodName === 'ENN' ? '#7C3AED' : '#005EB8';
  const label        = `${neighbourhoodName} Voice Agent`;

  const { user }                       = useAuth();
  const { contextData, contextPrompt } = useVoiceAgentContext();

  const [status,     setStatus]     = useState<Status>('idle');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const emailRef    = useRef<string | undefined>(undefined);
  const nameRef     = useRef<string>('User');
  const practiceRef = useRef<string | undefined>(undefined);
  const bufferRef   = useRef<ConversationEntry[]>([]);
  const convIdRef   = useRef<string | null>(null);
  const ctxRef      = useRef(contextData);

  useEffect(() => {
    emailRef.current    = contextData.email || user?.email;
    nameRef.current     = contextData.displayName || user?.email?.split('@')[0] || 'User';
    practiceRef.current = contextData.practiceName;
    ctxRef.current      = contextData;
  }, [contextData, user?.email]);

  const conversation = useConversation({
    onConnect: () => {
      setStatus('connected');
      setError(null);
      bufferRef.current = [];
    },

    onDisconnect: async () => {
      setStatus('disconnected');
      const email  = emailRef.current;
      const buffer = bufferRef.current;
      if (email && buffer.length > 0) {
        const ctx = ctxRef.current;
        await sendTranscriptEmail(email, buffer, convIdRef.current, neighbourhoodName, {
          displayName: ctx.displayName, role: ctx.role, practiceName: ctx.practiceName,
          practiceAddress: ctx.practiceAddress, practicePostcode: ctx.practicePostcode,
          practicePhone: ctx.practicePhone, practiceOdsCode: ctx.practiceOdsCode,
        });
      }
      convIdRef.current = null;
      bufferRef.current = [];
    },

    onMessage: (message) => {
      if (message.message && message.source) {
        const role = message.source === 'ai' ? 'assistant' : 'user';
        const last = bufferRef.current[bufferRef.current.length - 1];
        if (!last || last.message !== message.message || last.role !== role) {
          bufferRef.current.push({ role, message: message.message, timestamp: new Date().toISOString() });
        }
      }
      if ((message as any).type === 'conversation_initiation_metadata' && (message as any).conversation_id) {
        convIdRef.current = (message as any).conversation_id;
      }
    },

    onError: (error) => {
      console.error(`[${neighbourhoodName}Widget] Error:`, error);
      setStatus('error');
      setError(typeof error === 'string' ? error : 'Connection error occurred');
    },
  });

  const startConversation = async () => {
    if (status === 'connecting' || status === 'connected') return;
    setStatus('connecting');
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'elevenlabs-agent-url',
        { body: { agentId } },
      );
      if (fnError || !data?.signed_url) throw new Error(fnError?.message || 'Failed to get signed URL');
      await conversation.startSession({
        agentId,
        signedUrl: data.signed_url,
        dynamicVariables: {
          user_name:         nameRef.current,
          user_email:        emailRef.current || '',
          user_role:         contextData.role || '',
          practice_name:     practiceRef.current || '',
          practice_address:  contextData.practiceAddress || '',
          practice_postcode: contextData.practicePostcode || '',
          practice_phone:    contextData.practicePhone || '',
          practice_ods_code: contextData.practiceOdsCode || '',
          neighbourhood:     neighbourhoodName,
          dynamic_context:   contextPrompt,
        },
      });
    } catch (err: any) {
      setStatus('error');
      setError(err?.message || 'Failed to connect');
      toast.error(`Failed to start ${label}`);
    }
  };

  const endConversation = async () => {
    try { await conversation.endSession(); } catch {}
  };

  const toggleMic = async () => {
    try {
      if (isMicMuted) await (conversation as any).unmute?.();
      else            await (conversation as any).mute?.();
      setIsMicMuted(v => !v);
    } catch {}
  };

  useEffect(() => { return () => { conversation.endSession().catch(() => {}); }; }, []);

  // ── Inline UI — sits inside the NRES tab card ─────────────────────────────
  const isLive = status === 'connected';
  const isBusy = status === 'connecting';

  return (
    <div style={{ marginTop: 10 }}>
      <style>{`
        @keyframes nwAgentPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(0,94,184,0.4) }
          50%      { box-shadow: 0 0 0 6px rgba(0,94,184,0) }
        }
        @keyframes nwAgentSpin { to { transform: rotate(360deg) } }
      `}</style>

      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {/* Live indicator dot */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: isLive ? '#16A34A' : isBusy ? '#D97706' : status === 'error' ? '#DC2626' : '#94A3B8',
          animation: isLive ? 'nwAgentPulse 1.5s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize: '0.72rem', color: '#475569', flex: 1 }}>
          {status === 'idle'         && 'Start a voice session — transcript emailed when call ends'}
          {status === 'connecting'   && 'Connecting…'}
          {status === 'connected'    && 'Live — transcript will be emailed when you end the call'}
          {status === 'disconnected' && 'Session ended · check your email for the transcript'}
          {status === 'error'        && (error || 'Connection failed — try again')}
        </span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 6 }}>
        {/* Start button */}
        {(status === 'idle' || status === 'disconnected' || status === 'error') && (
          <button
            onClick={startConversation}
            style={{
              flex: 1, background: accentColour, border: 'none', borderRadius: 8,
              color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem',
              padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              fontFamily: 'inherit',
            }}
          >
            <Phone size={13} />
            {status === 'disconnected' ? 'Start new session' : 'Start voice session'}
          </button>
        )}

        {/* Connecting */}
        {isBusy && (
          <button disabled style={{
            flex: 1, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
            color: '#94A3B8', cursor: 'not-allowed', fontWeight: 600, fontSize: '0.78rem',
            padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            fontFamily: 'inherit',
          }}>
            <Loader2 size={13} style={{ animation: 'nwAgentSpin 1s linear infinite' }} />
            Connecting…
          </button>
        )}

        {/* Live controls */}
        {isLive && (
          <>
            <button
              onClick={toggleMic}
              title={isMicMuted ? 'Unmute mic' : 'Mute mic'}
              style={{
                background: isMicMuted ? '#FEE2E2' : '#F1F5F9', border: 'none', borderRadius: 8,
                cursor: 'pointer', padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {isMicMuted ? <MicOff size={14} color="#DC2626" /> : <Mic size={14} color="#475569" />}
            </button>
            <button
              onClick={endConversation}
              style={{
                flex: 1, background: '#DC2626', border: 'none', borderRadius: 8,
                color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem',
                padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                fontFamily: 'inherit',
              }}
            >
              <PhoneOff size={13} /> End call
            </button>
          </>
        )}
      </div>

      {/* No-email warning */}
      {!emailRef.current && status === 'idle' && (
        <p style={{
          margin: '6px 0 0', fontSize: '0.67rem', color: '#D97706',
          background: '#FFFBEB', borderRadius: 5, padding: '4px 8px', border: '1px solid #FDE68A',
        }}>
          ⚠️ No email in your profile — transcript cannot be sent
        </p>
      )}
    </div>
  );
};
