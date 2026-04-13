/**
 * NRESWidgetLoader.tsx — v4
 *
 * NRESWidgetEmbed now accepts optional override props so all agent tabs
 * (GP, PM, Patient, Translate, NRES) can reuse the same inline button
 * component with their own agent ID, label, colour and service type.
 */

import { useState, useRef, useEffect } from 'react';
import { useConversation } from '@11labs/react';
import { Loader2, Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVoiceAgentContext } from '@/hooks/useVoiceAgentContext';
import { useAuth } from '@/contexts/AuthContext';

// ── Default agent IDs (NRES / ENN programme agent) ────────────────────────────
const NRES_AGENT_ID = 'agent_7801knyxsxcxehsr8kynxgxz6xyr';
const ENN_AGENT_ID  = 'agent_6801kp1qmxn1f24b42407nn2gq57';

type Status = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface ConversationEntry {
  role: string;
  message: string;
  timestamp: string;
}

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
  serviceName: string,
  serviceType: string,
  userContext: Record<string, string | undefined>,
) {
  if (!userEmail || buffer.length === 0) return;
  try {
    const { error } = await supabase.functions.invoke('send-genie-transcript-email', {
      body: {
        userEmail,
        serviceName,
        conversationBuffer: toEmailBuffer(buffer),
        conversationId,
        serviceType,
        userContext,
      },
    });
    if (error) throw error;
    toast.success('Session summary emailed', { description: `Transcript sent to ${userEmail}` });
  } catch (err) {
    console.error(`[${serviceType}] Email failed:`, err);
    toast.error('Email failed', { description: 'Transcript could not be sent.' });
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface NRESWidgetEmbedProps {
  /** Used to resolve the default agent ID if agentId is not supplied */
  neighbourhoodName?: string;
  /** Override agent ID (used by GP, PM, Patient, Translate agents) */
  agentId?: string;
  /** Display label, e.g. "GP Voice Agent" */
  label?: string;
  /** Button / accent colour — mid-tone recommended */
  accentColour?: string;
  /** Service type sent to send-genie-transcript-email for email branding */
  serviceType?: string;
  /** Human-readable service name for the email subject / header */
  serviceName?: string;
}

export const NRESWidgetEmbed = ({
  neighbourhoodName = 'NRES',
  agentId: agentIdProp,
  label: labelProp,
  accentColour: accentColourProp,
  serviceType: serviceTypeProp,
  serviceName: serviceNameProp,
}: NRESWidgetEmbedProps) => {

  // Resolve defaults
  const resolvedAgentId     = agentIdProp ?? (neighbourhoodName === 'ENN' ? ENN_AGENT_ID : NRES_AGENT_ID);
  const resolvedAccent      = accentColourProp ?? (neighbourhoodName === 'ENN' ? '#7C3AED' : '#005EB8');
  const resolvedLabel       = labelProp ?? `${neighbourhoodName} Voice Agent`;
  const resolvedServiceType = serviceTypeProp ?? (neighbourhoodName === 'ENN' ? 'enn-agent' : 'nres-agent');
  const resolvedServiceName = serviceNameProp ?? resolvedLabel;

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
        await sendTranscriptEmail(email, buffer, convIdRef.current, resolvedServiceName, resolvedServiceType, {
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
      console.error(`[${resolvedServiceType}] Error:`, error);
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
        { body: { agentId: resolvedAgentId } },
      );
      if (fnError || !data?.signed_url) throw new Error(fnError?.message || 'Failed to get signed URL');
      await conversation.startSession({
        agentId:  resolvedAgentId,
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
      toast.error(`Failed to start ${resolvedLabel}`);
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

  const isLive = status === 'connected';
  const isBusy = status === 'connecting';

  return (
    <div style={{ marginTop: 10 }}>
      <style>{`
        @keyframes nwAgentPulse { 0%,100%{box-shadow:0 0 0 0 ${resolvedAccent}66} 50%{box-shadow:0 0 0 6px ${resolvedAccent}00} }
        @keyframes nwAgentSpin  { to{transform:rotate(360deg)} }
      `}</style>

      {/* Status row */}
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:7 }}>
        <div style={{
          width:8, height:8, borderRadius:'50%', flexShrink:0,
          background: isLive ? '#16A34A' : isBusy ? '#D97706' : status==='error' ? '#DC2626' : '#CBD5E1',
          animation: isLive ? 'nwAgentPulse 1.5s ease-in-out infinite' : 'none',
        }}/>
        <span style={{ fontSize:'0.71rem', color:'#64748B', lineHeight:1.4 }}>
          {status==='idle'         && 'Start a voice session — transcript emailed when call ends'}
          {status==='connecting'   && 'Connecting…'}
          {status==='connected'    && 'Live · transcript will be emailed when you end the call'}
          {status==='disconnected' && 'Session ended — check your email for the transcript'}
          {status==='error'        && (error || 'Connection failed — try again')}
        </span>
      </div>

      {/* Button row */}
      <div style={{ display:'flex', gap:6 }}>
        {(status==='idle' || status==='disconnected' || status==='error') && (
          <button onClick={startConversation} style={{
            flex:1, border:'none', borderRadius:8, color:'#fff', cursor:'pointer',
            fontWeight:700, fontSize:'0.77rem', padding:'8px 12px', fontFamily:'inherit',
            background: resolvedAccent,
            display:'flex', alignItems:'center', justifyContent:'center', gap:5,
            opacity: 0.92,
          }}
          onMouseEnter={e=>(e.currentTarget.style.opacity='1')}
          onMouseLeave={e=>(e.currentTarget.style.opacity='0.92')}
          >
            <Phone size={13}/>
            {status==='disconnected' ? 'Start new session' : 'Start voice session'}
          </button>
        )}

        {isBusy && (
          <button disabled style={{
            flex:1, background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:8,
            color:'#94A3B8', cursor:'not-allowed', fontWeight:600, fontSize:'0.77rem',
            padding:'8px 12px', display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontFamily:'inherit',
          }}>
            <Loader2 size={13} style={{ animation:'nwAgentSpin 1s linear infinite' }}/>
            Connecting…
          </button>
        )}

        {isLive && (
          <>
            <button onClick={toggleMic} title={isMicMuted ? 'Unmute mic' : 'Mute mic'} style={{
              background: isMicMuted ? '#FEE2E2' : '#F1F5F9', border:'none', borderRadius:8,
              cursor:'pointer', padding:'8px 10px',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {isMicMuted ? <MicOff size={14} color="#DC2626"/> : <Mic size={14} color="#475569"/>}
            </button>
            <button onClick={endConversation} style={{
              flex:1, background:'#DC2626', border:'none', borderRadius:8, color:'#fff',
              cursor:'pointer', fontWeight:700, fontSize:'0.77rem', padding:'8px 12px',
              display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontFamily:'inherit',
            }}>
              <PhoneOff size={13}/> End call
            </button>
          </>
        )}
      </div>

      {!emailRef.current && status==='idle' && (
        <p style={{ margin:'6px 0 0', fontSize:'0.66rem', color:'#D97706',
          background:'#FFFBEB', borderRadius:5, padding:'4px 8px', border:'1px solid #FDE68A' }}>
          ⚠️ No email in your profile — transcript cannot be sent
        </p>
      )}
    </div>
  );
};
