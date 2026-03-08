import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ExternalLink, ArrowLeft, Phone } from 'lucide-react';

interface SignpostingPageProps {
  type: 'severe' | 'safeguarding';
  onBack: () => void;
}

interface SignpostLink {
  title: string;
  description: string;
  colour: string;
  url?: string;
  isEmergency?: boolean;
}

const SEVERE_HARM_LINKS: SignpostLink[] = [
  {
    title: 'Learning from Patient Safety Events (LFPSE)',
    description: 'Report this event via the national patient safety reporting system',
    url: 'https://record.learn-from-patient-safety-events.nhs.uk/',
    colour: '#EF4444',
  },
  {
    title: 'ICB Patient Safety Team',
    description: 'Contact your local Integrated Care Board patient safety team for support',
    colour: '#F59E0B',
  },
  {
    title: 'Duty of Candour',
    description: 'Review your Duty of Candour obligations under Regulation 20 of the Health and Social Care Act 2008',
    url: 'https://www.cqc.org.uk/guidance-providers/all-services/duty-candour',
    colour: '#3B82F6',
  },
  {
    title: 'Medical Defence Organisation',
    description: 'Contact your MDO (e.g. MDU, MPS, MDDUS) for professional advice',
    colour: '#8B5CF6',
  },
  {
    title: 'Emergency — 999',
    description: 'If there is an immediate risk to life, call 999',
    colour: '#EF4444',
    isEmergency: true,
  },
];

const SAFEGUARDING_LINKS: SignpostLink[] = [
  {
    title: 'Local MASH / Adult Social Care',
    description: 'Report safeguarding concerns to your local Multi-Agency Safeguarding Hub or Adult Social Care team',
    colour: '#EF4444',
  },
  {
    title: 'Practice Safeguarding Lead',
    description: 'Discuss concerns with your practice safeguarding lead immediately',
    colour: '#F59E0B',
  },
  {
    title: 'ICB Named GP for Safeguarding',
    description: 'Contact your ICB named GP for safeguarding advice',
    colour: '#3B82F6',
  },
  {
    title: 'Emergency — 999',
    description: 'If there is an immediate risk to life, call 999',
    colour: '#EF4444',
    isEmergency: true,
  },
];

export const SignpostingPage: React.FC<SignpostingPageProps> = ({ type, onBack }) => {
  const isSevere = type === 'severe';
  const links = isSevere ? SEVERE_HARM_LINKS : SAFEGUARDING_LINKS;

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {isSevere
              ? 'This event requires formal reporting and support'
              : 'Safeguarding concerns require immediate action'
            }
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isSevere
              ? 'Document Studio cannot process severe harm events. Please use the following resources.'
              : 'Document Studio cannot process safeguarding concerns. Please use the following resources.'
            }
          </p>
          <p className="text-xs text-destructive font-medium mt-2">
            No data has been recorded or saved.
          </p>
        </div>
      </div>

      {/* Signposting cards */}
      <div className="space-y-2">
        {links.map((link, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3.5 rounded-r-xl border border-l-4 bg-background"
            style={{ borderLeftColor: link.colour }}
          >
            {link.isEmergency ? (
              <Phone className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: link.colour }} />
            ) : (
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: link.colour }} />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{link.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{link.description}</p>
              {link.url && (
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline flex items-center gap-1 mt-1"
                >
                  Open resource <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button variant="outline" onClick={onBack} className="w-full">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Return to Document Studio
      </Button>
    </div>
  );
};
