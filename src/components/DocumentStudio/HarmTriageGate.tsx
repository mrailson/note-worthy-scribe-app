import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ShieldAlert, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SignpostingPage } from './SignpostingPage';

interface HarmTriageGateProps {
  onContinue: (result: string) => void;
  onCancel: () => void;
}

const TRIAGE_OPTIONS = [
  {
    id: 'no-harm',
    label: 'No harm or low harm',
    description: 'A near-miss, minor issue, or learning opportunity.',
    colour: '#10B981',
    severity: 'low',
  },
  {
    id: 'moderate-harm',
    label: 'Moderate harm',
    description: 'The patient required additional treatment but recovered.',
    colour: '#F59E0B',
    severity: 'moderate',
  },
  {
    id: 'severe-harm',
    label: 'Severe harm or death',
    description: 'Lasting harm, permanent injury, or contributed to death.',
    colour: '#EF4444',
    severity: 'severe',
  },
  {
    id: 'safeguarding',
    label: 'Safeguarding concern',
    description: 'Suspected abuse, neglect, or risk to a child or vulnerable adult.',
    colour: '#EF4444',
    severity: 'safeguarding',
  },
] as const;

export const HarmTriageGate: React.FC<HarmTriageGateProps> = ({ onContinue, onCancel }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [showSignposting, setShowSignposting] = useState<'severe' | 'safeguarding' | null>(null);
  const [showModerateWarning, setShowModerateWarning] = useState(false);

  if (showSignposting) {
    return <SignpostingPage type={showSignposting} onBack={onCancel} />;
  }

  const handleSelect = (optionId: string) => {
    setSelected(optionId);
    
    if (optionId === 'no-harm') {
      onContinue('no-harm');
    } else if (optionId === 'moderate-harm') {
      setShowModerateWarning(true);
    } else if (optionId === 'severe-harm') {
      setShowSignposting('severe');
    } else if (optionId === 'safeguarding') {
      setShowSignposting('safeguarding');
    }
  };

  return (
    <div className="space-y-6">
      {/* Amber warning banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">Before we begin, we need to check something important</p>
          <p className="text-xs text-muted-foreground mt-1">This helps us provide appropriate guidance and ensure correct reporting.</p>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Did this event result in any of the following?</p>
        <div className="space-y-2">
          {TRIAGE_OPTIONS.map(option => (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              className={cn(
                'w-full flex items-start gap-3 p-3.5 rounded-r-xl border text-left transition-all',
                'border-l-4',
                'hover:shadow-sm'
              )}
              style={{
                borderLeftColor: option.colour,
                borderColor: selected === option.id ? option.colour : undefined,
                backgroundColor: selected === option.id ? `${option.colour}08` : undefined,
              }}
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{option.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{option.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Moderate harm signposting */}
      {showModerateWarning && (
        <div className="space-y-3 p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <p className="text-sm font-semibold text-foreground">Before continuing, please consider:</p>
          <div className="space-y-2">
            {[
              { title: 'Report on LFPSE', desc: 'Record this event via the Learning from Patient Safety Events service', url: 'https://record.learn-from-patient-safety-events.nhs.uk/' },
              { title: 'Discuss with your Clinical Lead', desc: 'Share the event with your clinical lead for guidance' },
              { title: 'Consider ICB notification', desc: 'Your ICB Patient Safety Team may need to be informed' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-background">
                <ShieldAlert className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex items-center gap-1 mt-1">
                      Open LFPSE <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Button onClick={() => onContinue('moderate-harm')} className="w-full mt-2">
            Continue to Learning Event Report
          </Button>
        </div>
      )}
    </div>
  );
};
