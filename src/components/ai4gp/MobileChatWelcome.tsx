import React, { useRef, useEffect } from 'react';
import { Stethoscope, Building2, HeartPulse, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AskAIRole } from './RoleToggle';

// Top quick-start chips per role
const GP_CHIPS = [
  { label: "NICE hypertension", prompt: "What does NICE recommend for hypertension management?" },
  { label: "Red flags headache", prompt: "What are the red flag symptoms for headache?" },
  { label: "Type 2 diabetes", prompt: "Summarise the latest NICE guidance on Type 2 diabetes" },
  { label: "2WW referral", prompt: "What's the 2WW referral pathway for suspected cancer?" },
  { label: "Antibiotic choice", prompt: "What's the first-line antibiotic for community-acquired pneumonia?" },
  { label: "Drug interaction", prompt: "Check for drug interactions between warfarin and common medications" },
  { label: "COPD management", prompt: "How should I manage an acute COPD exacerbation in primary care?" },
  { label: "QOF indicators", prompt: "What are the key QOF indicators for diabetes management?" },
];

const PM_CHIPS = [
  { label: "Complaint response", prompt: "Help me draft a response to a patient complaint" },
  { label: "CQC preparation", prompt: "What should I prepare for a CQC inspection?" },
  { label: "PLT planning", prompt: "Help me plan a Protected Learning Time session for our practice" },
  { label: "Meeting agenda", prompt: "Create an agenda for a practice team meeting" },
  { label: "HR guidance", prompt: "What's the correct process for managing staff performance issues?" },
  { label: "Patient letter", prompt: "Draft a patient communication about practice changes" },
  { label: "Risk assessment", prompt: "Help me create a workplace risk assessment template" },
  { label: "GMS contract", prompt: "Explain the key elements of the GMS contract" },
];

const AW_CHIPS = [
  { label: "Care plan (PCSP)", prompt: "Generate a Personalised Care and Support Plan for a frail elderly patient" },
  { label: "Care Home round", prompt: "Draft a Care Home weekly round template with RAG review status" },
  { label: "Polypharmacy review", prompt: "Run a STOPP/START polypharmacy review on a sample medication list" },
  { label: "Falls assessment", prompt: "Falls multifactorial risk assessment with intervention plan" },
  { label: "MDT agenda (75+)", prompt: "MDT meeting agenda for over-75s with eFI > 0.36" },
  { label: "Dementia letter", prompt: "Draft a dementia diagnosis communication letter" },
  { label: "Carer support", prompt: "Carer support pack with local signposting" },
  { label: "End of Life guide", prompt: "End of Life conversation guide for the GP consultation" },
];

const ROLE_CONFIG = {
  gp: {
    icon: Stethoscope,
    subtitle: 'Clinical Mode',
    welcome: "Hello! I'm your clinical assistant for UK General Practice. Ask me about NICE guidelines, prescribing, referrals, or clinical letters.",
    chips: GP_CHIPS,
  },
  'practice-manager': {
    icon: Building2,
    subtitle: 'Practice Manager Mode',
    welcome: "Hello! I'm here to help with practice management — from CQC compliance and HR policies to complaint responses and team communications.",
    chips: PM_CHIPS,
  },
  'ageing-well': {
    icon: HeartPulse,
    subtitle: 'Ageing Well Mode',
    welcome: "Hello! I'm here to support Ageing Well services — frailty reviews, anticipatory care planning, MDT coordination, and proactive patient identification.",
    chips: AW_CHIPS,
  },
} as const;

interface MobileChatWelcomeProps {
  selectedRole: AskAIRole;
  onRoleChange: (role: AskAIRole) => void;
  onSelectPrompt: (prompt: string) => void;
  isLoading?: boolean;
}

export const MobileChatWelcome: React.FC<MobileChatWelcomeProps> = ({
  selectedRole,
  onRoleChange,
  onSelectPrompt,
  isLoading = false,
}) => {
  const config = ROLE_CONFIG[selectedRole];
  const chipsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chipsRef.current) {
      chipsRef.current.scrollLeft = 0;
    }
  }, [selectedRole]);

  return (
    <div className="flex flex-col h-full">
      {/* Gradient hero header */}
      <div
        className="px-5 pt-6 pb-5"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(200 80% 45%) 100%)',
        }}
      >
        {/* Role tabs — underline style */}
        <div className="flex gap-6 mb-5">
          {([
            { key: 'gp' as const, label: 'GP Clinical', icon: Stethoscope },
            { key: 'practice-manager' as const, label: 'Practice Manager', icon: Building2 },
            { key: 'ageing-well' as const, label: 'Ageing Well', icon: HeartPulse },
          ]).map((tab) => {
            const active = selectedRole === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onRoleChange(tab.key)}
                className={cn(
                  "relative flex items-center gap-1.5 pb-2 text-sm font-medium transition-colors",
                  active ? "text-white" : "text-white/60"
                )}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-white" />
                )}
              </button>
            );
          })}
        </div>

        {/* Welcome bubble */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Sparkles className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold tracking-wide uppercase text-white/70 mb-1">
              {config.subtitle}
            </p>
            <p className="text-[14px] leading-relaxed text-white/95">
              {config.welcome}
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable chip row */}
      <div className="bg-background px-1 pt-4 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-4 mb-2.5">
          Quick start
        </p>
        <div
          ref={chipsRef}
          className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {config.chips.map((chip, i) => (
            <button
              key={i}
              onClick={() => onSelectPrompt(chip.prompt)}
              disabled={isLoading}
              className={cn(
                "flex-shrink-0 px-3.5 py-2 rounded-full text-[13px] font-medium",
                "border border-border bg-muted/40 text-foreground",
                "transition-all active:scale-[0.96] touch-manipulation",
                "hover:bg-primary/10 hover:border-primary/30 hover:text-primary",
                isLoading && "opacity-40 pointer-events-none"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
