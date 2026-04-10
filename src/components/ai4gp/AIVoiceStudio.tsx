import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

// Load ElevenLabs widget script once
function useElevenLabs() {
  useEffect(() => {
    if (document.querySelector('script[src*="elevenlabs"]')) return;
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    s.async = true;
    document.body.appendChild(s);
  }, []);
}

function ElevenLabsWidget({ agentId }: { agentId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';
    const el = document.createElement('elevenlabs-convai');
    el.setAttribute('agent-id', agentId);
    ref.current.appendChild(el);
    return () => {
      if (ref.current) ref.current.innerHTML = '';
    };
  }, [agentId]);
  return <div ref={ref} style={{ minHeight: 60 }} />;
}

const AGENT_IDS: Record<string, string> = {
  gp: 'agent_01jwry2fzme7xsb2mwzatxseyt',
  pm: 'agent_01jwry2fzme7xsb2mwzatxseyt',
  patient: 'agent_3501knsz3wj8f0frkttr1yd90k72',
  translate: 'agent_2601knsxn311f9evq5zs0rrese7s',
};

interface WidgetMode {
  id: string;
  label: string;
  color: string;
  icon: string;
  type: 'widget';
  description: string;
  examples: string[];
}

interface InfoMode {
  id: string;
  label: string;
  color: string;
  icon: string;
  type: 'info';
  tagline: string;
  features: string[];
  footnote?: string;
  phone: string;
  phoneNote: string;
  phoneExplainer: string;
  actionLabel: string;
  actionColor: string;
}

type ModeConfig = WidgetMode | InfoMode;

const ALL_MODES: ModeConfig[] = [
  {
    id: 'gp', label: 'GP', color: '#7C2855', icon: '⚕️', type: 'widget',
    description: 'Ask clinical questions — get GP-level guidance instantly from NHS frameworks.',
    examples: [
      'What are the NICE guidelines for managing new-onset atrial fibrillation?',
      'Summarise the red flag symptoms for suspected cauda equina syndrome',
      'What blood tests should I consider for unexplained weight loss in over-60s?',
      'When should I refer a child with recurrent tonsillitis to ENT?',
    ],
  },
  {
    id: 'pm', label: 'Practice Manager', color: '#ED8B00', icon: '📋', type: 'widget',
    description: 'Practice management — CQC, HR, complaints, NHS contracts, operations.',
    examples: [
      'What are the CQC key lines of enquiry for the Safe domain?',
      'Draft a response to a patient complaint about appointment availability',
      'What are the statutory notice periods for dismissing a salaried GP?',
      'Summarise our obligations under the NHS Standard Contract for enhanced access',
    ],
  },
  {
    id: 'patient', label: 'Patient', color: '#41B6E6', icon: '👤', type: 'info',
    tagline: '"Your GP Practice in your pocket"',
    features: [
      'Symptom checker — describe how you feel and get clear advice on what to do next',
      'Request a GP review — answer a few quick questions and we\'ll submit it to your practice today',
      'Understand your results — "my cholesterol is 6.8, is that bad?" — explained in plain English',
      'Medication questions — what\'s this tablet for? Can I take it with paracetamol? I\'ve missed a dose',
      'Complaints & feedback — guided step by step, submitted to your Practice Manager',
    ],
    footnote: 'No waiting on hold. No jargon. Just clear, caring advice — like talking to your GP.',
    phone: '01327 221722',
    phoneNote: 'No internet? Call {phone} from any phone to speak to your GP Practice Assistant directly.',
    phoneExplainer: 'Designed for patients who aren\'t online — a plain old telephone service powered by AI. No internet, no smartphone, no app needed. Just pick up the phone and talk.',
    actionLabel: 'Talk to Your GP Assistant', actionColor: '#E8175D',
  },
  {
    id: 'translate', label: 'Live Translate', color: '#006747', icon: '🌐', type: 'info',
    tagline: '"Real-time patient translation — no interpreter needed"',
    features: [
      'Just say "I need translation" and name the language',
      'No speak English — your patient speaks their language — it translates both ways live',
      'Medical terms translated into plain language your patient will understand',
      'Instant — no booking interpreters, no waiting, no phone loops',
      'Safety built in — it flags any clinical red flags it hears during translation',
      'Any language — Polish, Urdu, Arabic, Romanian, Bengali, Mandarin, and many more',
    ],
    phone: '01280 730716',
    phoneNote: 'On a home visit? Call {phone} from any phone for instant translation — no internet needed.',
    phoneExplainer: 'Works as a plain old telephone service — just call the number and start interpreting. No app, no internet, no login required. Ideal for home visits and patients without technology.',
    actionLabel: 'Start Interpreting', actionColor: '#006747',
  },
];

const AIVoiceStudio: React.FC = () => {
  useElevenLabs();
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const activeData = ALL_MODES.find(m => m.id === activeMode);

  const handleModeClick = (modeId: string) => {
    setActiveMode(prev => prev === modeId ? null : modeId);
    setQuery('');
  };

  const renderPhoneNote = (mode: InfoMode) => {
    const parts = mode.phoneNote.split('{phone}');
    return (
      <span className="text-[13px] text-foreground">
        {parts[0]}
        <strong className="text-base" style={{ color: mode.color }}>{mode.phone}</strong>
        {parts[1]}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3.5">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-[22px] text-white"
          style={{ background: 'linear-gradient(135deg, #003087, #0072CE)' }}
        >
          🎙️
        </div>
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: '#003087' }}>GP Notewell AI Voice</h1>
          <p className="text-[13px] text-muted-foreground">
            Your intelligent programme assistant — powered by AI, grounded in NHS guidance
          </p>
        </div>
      </div>

      {/* 2×2 Mode Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ALL_MODES.map((mode) => {
          const isActive = activeMode === mode.id;
          const isInfo = mode.type === 'info';
          return (
            <button
              key={mode.id}
              onClick={() => handleModeClick(mode.id)}
              className={cn(
                'relative flex flex-col items-start gap-1.5 p-4 rounded-xl text-left transition-all duration-200 border-2 cursor-pointer',
                isActive ? 'text-white' : 'bg-card text-foreground border-border hover:shadow-md'
              )}
              style={{
                ...(isActive
                  ? { background: mode.color, borderColor: mode.color, boxShadow: `0 4px 16px ${mode.color}44` }
                  : { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }),
              }}
            >
              {isInfo && (
                <span
                  className="absolute top-2.5 right-3 text-[11px] font-semibold px-2 py-0.5 rounded-md"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.25)' : `${mode.color}18`,
                    color: isActive ? '#fff' : mode.color,
                  }}
                >
                  Direct Link ↗
                </span>
              )}
              <div className="flex items-center gap-2">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                  style={{ background: isActive ? 'rgba(255,255,255,0.2)' : `${mode.color}14` }}
                >
                  {mode.icon}
                </span>
                <span className="font-bold text-[15px]">{mode.label}</span>
              </div>
              <p className={cn('text-xs leading-snug m-0', isActive ? 'opacity-90' : 'opacity-65')}>
                {mode.type === 'info' ? mode.tagline : mode.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Widget Panel (GP / Practice Manager) */}
      {activeData && activeData.type === 'widget' && (() => {
        const widget = activeData as WidgetMode;
        return (
          <Card className="rounded-[14px] border p-6 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2.5 mb-4">
              <span
                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg text-white"
                style={{ background: widget.color }}
              >
                {widget.icon}
              </span>
              <div>
                <h2 className="text-[17px] font-bold" style={{ color: '#003087' }}>{widget.label} Mode</h2>
                <p className="text-xs text-muted-foreground">Ask anything within this context</p>
              </div>
            </div>

            {/* GP Warning */}
            {activeMode === 'gp' && (
              <div className="mb-4 p-3 rounded-lg text-xs leading-relaxed flex items-start gap-2.5"
                style={{ background: '#FFF3CD', border: '1px solid #FFCB05', color: '#594300' }}>
                <span className="text-lg shrink-0">⚠️</span>
                <span>
                  <strong>Proof of Concept Only.</strong> This feature is not approved for use in real patient care.
                  It is provided as part of the analogue-to-digital journey to demonstrate what AI-assisted clinical
                  guidance could look like in the future. Always follow established clinical pathways and professional judgement.
                </span>
              </div>
            )}

            {/* ElevenLabs Widget */}
            <div className="bg-muted rounded-[10px] p-4 border border-border mb-4 text-center">
              <p className="text-xs font-semibold text-muted-foreground mb-2.5">
                🎙️ Click the microphone below to start a voice conversation
              </p>
              <ElevenLabsWidget agentId={AGENT_IDS[widget.id]} />
            </div>

            {/* Text input */}
            <div className="flex gap-2.5 items-center mb-4">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Or type your question about ${widget.label.toLowerCase()}...`}
                className="flex-1"
              />
              <Button size="icon" className="w-11 h-11 rounded-[10px] shrink-0" style={{ background: '#003087' }}>
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* Example prompts */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Try asking...</p>
              <div className="flex flex-col gap-1.5">
                {widget.examples.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setQuery(ex)}
                    className="text-left bg-muted border border-border rounded-lg px-3 py-2 text-[13px] text-foreground cursor-pointer hover:bg-accent transition-colors leading-snug"
                  >
                    💡 {ex}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Info Panel (Patient / Live Translate) */}
      {activeData && activeData.type === 'info' && (() => {
        const info = activeData as InfoMode;
        return (
          <Card className="rounded-[14px] border p-6 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span
                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg text-white"
                style={{ background: info.color }}
              >
                {info.icon}
              </span>
              <h2 className="text-[17px] font-bold" style={{ color: '#003087' }}>{info.label}</h2>
            </div>

            <p className="text-sm font-semibold italic mb-3.5" style={{ color: info.color }}>
              {info.tagline}
            </p>

            {/* Features */}
            <div className="flex flex-col gap-2 mb-2">
              {info.features.map((feat, i) => (
                <div key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                  <span
                    className="w-[22px] h-[22px] rounded-md shrink-0 mt-0.5 flex items-center justify-center text-[11px] font-bold"
                    style={{ background: `${info.color}18`, color: info.color }}
                  >
                    {info.id === 'patient' ? '💬' : '🌐'}
                  </span>
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            {info.footnote && (
              <p className="text-xs text-muted-foreground italic mb-2">{info.footnote}</p>
            )}

            {/* ElevenLabs Widget */}
            <div className="mb-2">
              <ElevenLabsWidget agentId={AGENT_IDS[info.id]} />
            </div>

            {/* Phone section */}
            <div className="bg-muted rounded-[10px] p-3.5 border border-border mb-2">
              <div className="flex items-center gap-2.5 mb-2">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm text-white"
                  style={{ background: info.color }}
                >
                  📞
                </span>
                {renderPhoneNote(info)}
              </div>
              <div className="ml-[38px]">
                <p
                  className="text-xs text-muted-foreground leading-relaxed bg-card p-2 px-3 rounded-md"
                  style={{ borderLeft: `3px solid ${info.color}` }}
                >
                  ℹ️ {info.phoneExplainer}
                </p>
              </div>
            </div>

            {/* Try it prompt */}
            <p className="text-center text-[13px] text-muted-foreground italic">
              👆 Click the microphone widget above to start
            </p>
          </Card>
        );
      })()}

      {/* Bottom summary */}
      <Card className="rounded-[14px] border p-5 shadow-sm">
        <h3 className="text-sm font-bold mb-3" style={{ color: '#003087' }}>What you can do</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 gap-x-5">
          {[
            { icon: '⚕️', text: 'Ask clinical questions — get GP-level guidance instantly' },
            { icon: '📋', text: 'Practice management — CQC, HR, complaints, NHS contracts' },
            { icon: '👤', text: 'Patient support — plain English health advice by phone or web' },
            { icon: '🌐', text: 'Live translation — 15 languages, works by phone or online' },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span>{f.icon}</span><span>{f.text}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground italic">
          Powered by AI, grounded in NHS guidance. Try it now.
        </p>
      </Card>
    </div>
  );
};

export default AIVoiceStudio;
