import React from 'react';
import { Stethoscope, Building2, HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AskAIRole } from './RoleToggle';

const GP_QUICK_PICKS = [
  { label: "NICE hypertension", prompt: "What does NICE recommend for hypertension management?" },
  { label: "Red flags headache", prompt: "What are the red flag symptoms for headache?" },
  { label: "Type 2 diabetes", prompt: "Summarise the latest NICE guidance on Type 2 diabetes" },
  { label: "2WW referral", prompt: "What's the 2WW referral pathway for suspected cancer?" },
  { label: "Antibiotic choice", prompt: "What's the first-line antibiotic for community-acquired pneumonia?" },
  { label: "Drug interaction", prompt: "Check for drug interactions between warfarin and common medications" },
  { label: "COPD exacerbation", prompt: "How should I manage an acute COPD exacerbation in primary care?" },
  { label: "Child safeguarding", prompt: "What are the safeguarding red flags in children I should look for?" },
  { label: "Sick note guidance", prompt: "What's the guidance on fit notes for mental health conditions?" },
  { label: "QOF indicators", prompt: "What are the key QOF indicators for diabetes management?" },
];

const PM_QUICK_PICKS = [
  { label: "Complaint response", prompt: "Help me draft a response to a patient complaint" },
  { label: "CQC prep", prompt: "What should I prepare for a CQC inspection?" },
  { label: "PLT Planning", prompt: "Help me plan a Protected Learning Time session for our practice" },
  { label: "Meeting agenda", prompt: "Create an agenda for a practice team meeting" },
  { label: "QOF targets", prompt: "What are the current QOF targets we need to focus on?" },
  { label: "HR guidance", prompt: "What's the correct process for managing staff performance issues?" },
  { label: "Patient letter", prompt: "Draft a patient communication about practice changes" },
  { label: "Training needs", prompt: "What mandatory training do practice staff need annually?" },
  { label: "Risk assessment", prompt: "Help me create a workplace risk assessment template" },
  { label: "Contract query", prompt: "Explain the key elements of the GMS contract" },
];

const AW_QUICK_PICKS = [
  { label: "Care plan (PCSP)", prompt: "Generate a Personalised Care and Support Plan (PCSP) for a frail elderly patient" },
  { label: "Care Home round", prompt: "Draft a Care Home weekly round template with RAG review status per resident" },
  { label: "Polypharmacy review", prompt: "Run a STOPP/START polypharmacy review on a sample medication list" },
  { label: "Anticipatory care", prompt: "Produce an Anticipatory Care Plan aligned to ReSPECT" },
  { label: "Falls assessment", prompt: "Falls multifactorial risk assessment with intervention plan" },
  { label: "MDT agenda (75+)", prompt: "MDT meeting agenda for over-75s with eFI > 0.36" },
  { label: "Dementia letter", prompt: "Draft a dementia diagnosis communication letter for patient and family" },
  { label: "Carer support", prompt: "Carer support pack with local signposting" },
  { label: "End of Life guide", prompt: "End of Life conversation guide for the GP consultation" },
  { label: "Cohort logic", prompt: "Define cohort logic to identify patients eligible for proactive Ageing Well review" },
];

interface MobileRoleQuickPicksProps {
  selectedRole: AskAIRole;
  onSelectPrompt: (prompt: string) => void;
  isLoading?: boolean;
}

export const MobileRoleQuickPicks: React.FC<MobileRoleQuickPicksProps> = ({
  selectedRole,
  onSelectPrompt,
  isLoading = false,
}) => {
  const quickPicks = selectedRole === 'practice-manager' 
    ? PM_QUICK_PICKS 
    : selectedRole === 'ageing-well'
    ? AW_QUICK_PICKS
    : GP_QUICK_PICKS;

  const roleIcon = selectedRole === 'practice-manager'
    ? Building2
    : selectedRole === 'ageing-well'
    ? HeartPulse
    : Stethoscope;

  const Icon = roleIcon;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span>Quick start prompts</span>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {quickPicks.map((pick, index) => (
          <button
            key={index}
            onClick={() => onSelectPrompt(pick.prompt)}
            disabled={isLoading}
            className={cn(
              "px-3 py-2.5 text-sm text-left bg-muted/50 hover:bg-muted rounded-lg",
              "transition-colors touch-manipulation active:scale-[0.98]",
              "min-h-[44px] border border-border/50",
              isLoading && "opacity-50 cursor-not-allowed"
            )}
          >
            {pick.label}
          </button>
        ))}
      </div>
    </div>
  );
};
