import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mic, MicOff, Send, AlertTriangle, Lightbulb, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CompactMicButton } from '@/components/ai4gp/studio/CompactMicButton';

interface ModeConfig {
  id: string;
  label: string;
  color: string;
  icon: string;
  type: 'widget' | 'link';
  description: string;
  href?: string;
  examples?: string[];
}

const MODES: ModeConfig[] = [
  {
    id: 'overview',
    label: 'Overview',
    color: '#0072CE',
    icon: '🏠',
    type: 'widget',
    description: 'Programme summary, key metrics, and quick navigation across all NRES services.',
  },
  {
    id: 'nres',
    label: 'NRES',
    color: '#00A499',
    icon: '🏥',
    type: 'widget',
    description: 'NRES programme knowledge — targets, funding, buy-back, practice operations.',
  },
  {
    id: 'gp',
    label: 'GP',
    color: '#7C2855',
    icon: '⚕️',
    type: 'widget',
    description: 'Ask clinical questions — get GP-level guidance instantly from NHS frameworks.',
    examples: [
      'What are the NICE guidelines for managing new-onset atrial fibrillation?',
      'Summarise the red flag symptoms for suspected cauda equina syndrome',
      'What blood tests should I consider for unexplained weight loss in over-60s?',
      'When should I refer a child with recurrent tonsillitis to ENT?',
    ],
  },
  {
    id: 'pm',
    label: 'Practice Manager',
    color: '#ED8B00',
    icon: '📋',
    type: 'widget',
    description: 'Practice management — CQC, HR, complaints, NHS contracts, operations.',
    examples: [
      'What are the CQC key lines of enquiry for the Safe domain?',
      'Draft a response to a patient complaint about appointment availability',
      'What are the statutory notice periods for dismissing a salaried GP?',
      'Summarise our obligations under the NHS Standard Contract for enhanced access',
    ],
  },
  {
    id: 'patient',
    label: 'Patient',
    color: '#41B6E6',
    icon: '👤',
    type: 'link',
    description: 'Patient support — plain English health advice. Opens the patient-facing portal.',
    href: '#patient-portal',
    examples: [
      'What should I expect at an NHS health check?',
      'How do I order a repeat prescription online?',
      "What's the difference between a GP and an Advanced Nurse Practitioner?",
      "I've been referred for blood tests — do I need to fast beforehand?",
    ],
  },
  {
    id: 'translate',
    label: 'Translate Now',
    color: '#006747',
    icon: '🌐',
    type: 'link',
    description: 'Real-time AI translation service — 15 languages with ElevenLabs voice output.',
    href: '#translate',
  },
];

const FEATURES = [
  { icon: '💬', text: 'Ask clinical questions — get GP-level guidance instantly' },
  { icon: '📊', text: 'NRES programme knowledge — targets, funding, buy-back, practice' },
  { icon: '📝', text: 'Practice management — CQC, HR, complaints, NHS contracts' },
  { icon: '❤️', text: 'Patient support — plain English health advice' },
];

export const AIVoiceStudio: React.FC = () => {
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const activeConfig = MODES.find((m) => m.id === activeMode);

  const handleModeClick = (mode: ModeConfig) => {
    if (mode.type === 'link') {
      // Direct links don't expand a panel
      setActiveMode(null);
      return;
    }
    setActiveMode(activeMode === mode.id ? null : mode.id);
    setQuery('');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3.5">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl text-white"
          style={{ background: 'linear-gradient(135deg, #003087, #0072CE)' }}
        >
          🎙️
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#003087' }}>
            GP Notewell AI Voice
          </h2>
          <p className="text-xs text-muted-foreground">
            Your intelligent programme assistant — powered by AI, grounded in NHS guidance
          </p>
        </div>
      </div>

      {/* Mode selector grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {MODES.map((mode) => {
          const isActive = activeMode === mode.id;
          const isLink = mode.type === 'link';

          return (
            <button
              key={mode.id}
              onClick={() => handleModeClick(mode)}
              className={cn(
                'relative flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer',
                isActive
                  ? 'text-white shadow-lg'
                  : 'bg-card text-card-foreground border-border hover:shadow-md'
              )}
              style={
                isActive
                  ? { background: mode.color, borderColor: mode.color, boxShadow: `0 4px 16px ${mode.color}44` }
                  : undefined
              }
            >
              {isLink && (
                <span
                  className="absolute top-2.5 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-md"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.25)' : `${mode.color}18`,
                    color: isActive ? '#fff' : mode.color,
                  }}
                >
                  Direct Link <ExternalLink className="inline h-2.5 w-2.5 -mt-0.5" />
                </span>
              )}
              <div className="flex items-center gap-2">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.2)' : `${mode.color}14`,
                  }}
                >
                  {mode.icon}
                </span>
                <span className="font-bold text-sm">{mode.label}</span>
              </div>
              <p
                className={cn(
                  'text-xs leading-snug m-0',
                  isActive ? 'opacity-90' : 'opacity-60'
                )}
              >
                {mode.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active mode panel */}
      {activeMode && activeConfig && (
        <Card className="animate-fade-in border shadow-sm">
          <CardContent className="p-5 space-y-4">
            {/* Panel header */}
            <div className="flex items-center gap-2.5">
              <span
                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-base text-white"
                style={{ background: activeConfig.color }}
              >
                {activeConfig.icon}
              </span>
              <div>
                <h3 className="text-[15px] font-bold" style={{ color: '#003087' }}>
                  {activeConfig.label} Mode
                </h3>
                <p className="text-xs text-muted-foreground">Ask anything within this context</p>
              </div>
            </div>

            {/* Input area */}
            <div className="flex gap-2.5 items-center">
              <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-[10px] px-3 py-2 border">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Ask about ${activeConfig.label.toLowerCase()}...`}
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-auto py-0 min-h-0 text-sm"
                />
                <CompactMicButton
                  onTranscriptUpdate={(text) => setQuery(text)}
                  currentValue={query}
                  className="h-9 w-9"
                />
              </div>
              <Button
                size="icon"
                className="h-11 w-11 rounded-[10px] shrink-0"
                style={{ background: '#003087' }}
                disabled={!query.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {/* GP warning banner */}
            {activeMode === 'gp' && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg text-xs leading-relaxed"
                style={{ background: '#FFF3CD', border: '1px solid #FFCB05', color: '#594300' }}
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#B8860B' }} />
                <span>
                  <strong>Proof of Concept Only.</strong> This feature is not approved for use in real patient care.
                  It is provided as part of the analogue-to-digital journey to demonstrate what AI-assisted clinical
                  guidance could look like in the future. Always follow established clinical pathways and professional judgement.
                </span>
              </div>
            )}

            {/* Example prompts */}
            {activeConfig.examples && activeConfig.examples.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Try asking...</p>
                <div className="flex flex-col gap-1.5">
                  {activeConfig.examples.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(ex)}
                      className="flex items-start gap-2 text-left bg-muted/40 hover:bg-muted border border-border rounded-lg px-3 py-2.5 text-xs leading-snug transition-colors cursor-pointer"
                    >
                      <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                      <span>{ex}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Features summary */}
      <Card className="border shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <h3 className="text-sm font-bold mb-3" style={{ color: '#003087' }}>
            What you can do
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{f.icon}</span>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/70 italic mt-3">
            Powered by AI, grounded in NHS guidance. Try it now.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIVoiceStudio;
