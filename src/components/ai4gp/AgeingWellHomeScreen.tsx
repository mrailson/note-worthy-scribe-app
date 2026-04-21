import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { toast } from 'sonner';
import { ContextBanner } from './ContextBanner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ClipboardList,
  Building2,
  Pill,
  FileText,
  Footprints,
  Users,
  Brain,
  HeartHandshake,
  Feather,
  BarChart3,
} from 'lucide-react';

interface AgeingWellHomeScreenProps {
  setInput: (text: string) => void;
  focusInput?: () => void;
}

const AGEING_WELL_PROMPTS = [
  {
    id: 'pcsp',
    emoji: '📋',
    shortTitle: 'Personalised Care Plan',
    title: 'Generate a Personalised Care and Support Plan (PCSP) for a frail elderly patient',
    prompt: 'Generate a Personalised Care and Support Plan (PCSP) for a frail elderly patient. Include sections for: current health conditions, functional status, medication review, social circumstances, patient goals and preferences, care coordination, and review date. Follow NHS England PCSP guidance.',
    icon: ClipboardList,
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    id: 'care-home-round',
    emoji: '🏥',
    shortTitle: 'Care Home Round Template',
    title: 'Draft a Care Home weekly round template with RAG review status per resident',
    prompt: 'Draft a Care Home weekly round template with RAG (Red/Amber/Green) review status per resident. Include columns for: resident name, RAG status, key issues, medications due for review, escalation actions, and clinician notes. Format as a structured table suitable for printing.',
    icon: Building2,
    gradient: 'from-red-500 to-rose-600',
  },
  {
    id: 'polypharmacy',
    emoji: '💊',
    shortTitle: 'STOPP/START Review',
    title: 'Run a STOPP/START polypharmacy review on a sample medication list',
    prompt: 'Run a STOPP/START polypharmacy review. Apply STOPP/START criteria version 3 to identify potentially inappropriate prescribing in an older adult. For each flagged medication, explain the concern and suggest an alternative or deprescribing approach. I will provide the medication list.',
    icon: Pill,
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'anticipatory-care',
    emoji: '📝',
    shortTitle: 'Anticipatory Care Plan',
    title: 'Produce an Anticipatory Care Plan aligned to ReSPECT',
    prompt: 'Produce an Anticipatory Care Plan aligned to the ReSPECT framework for a frail elderly patient. Include sections for: clinical summary, current functional status, patient values and preferences, recommended ceiling of treatment, DNACPR considerations, preferred place of care/death, and emergency contact details.',
    icon: FileText,
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'falls-assessment',
    emoji: '🚶',
    shortTitle: 'Falls Risk Assessment',
    title: 'Falls multifactorial risk assessment with intervention plan',
    prompt: 'Create a comprehensive multifactorial falls risk assessment for an elderly patient. Cover: falls history, gait and balance assessment (Timed Up and Go), vision, medications review (falls-risk drugs), postural hypotension screen, home hazards, footwear, bone health/osteoporosis risk, and a structured intervention plan for each identified risk factor. Align to NICE CG161.',
    icon: Footprints,
    gradient: 'from-orange-500 to-amber-600',
  },
  {
    id: 'mdt-agenda',
    emoji: '👥',
    shortTitle: 'MDT Agenda (Over-75s)',
    title: 'MDT meeting agenda for over-75s with eFI > 0.36',
    prompt: 'Create an MDT meeting agenda for discussing over-75s patients with an electronic Frailty Index (eFI) greater than 0.36 (moderate/severe frailty). Include sections for: patient list with eFI scores, medication review priorities, falls risk, social isolation concerns, advance care planning status, care home residents, and actions/owners. Format for a 60-minute meeting.',
    icon: Users,
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    id: 'dementia-letter',
    emoji: '🧠',
    shortTitle: 'Dementia Diagnosis Letter',
    title: 'Draft a dementia diagnosis communication letter for patient and family',
    prompt: 'Draft a compassionate, clear dementia diagnosis communication letter for a patient and their family. Include: the diagnosis in plain language, what it means practically, available support services (Alzheimer\'s Society, local memory café, carers\' support), medication options if appropriate, driving/DVLA implications, lasting power of attorney signposting, and follow-up arrangements. Use a warm, professional tone.',
    icon: Brain,
    gradient: 'from-pink-500 to-fuchsia-600',
  },
  {
    id: 'carer-support',
    emoji: '🤝',
    shortTitle: 'Carer Support Pack',
    title: 'Carer support pack with local signposting',
    prompt: 'Create a comprehensive carer support pack for someone caring for a frail elderly relative. Include: recognising carer burnout, accessing a carer\'s assessment from the local authority, Carers UK helpline, respite care options, Attendance Allowance and Carer\'s Allowance guidance, local support groups, emergency planning, and self-care strategies. Format as a patient-friendly handout.',
    icon: HeartHandshake,
    gradient: 'from-cyan-500 to-sky-600',
  },
  {
    id: 'eol-guide',
    emoji: '🕊️',
    shortTitle: 'End of Life Guide',
    title: 'End of Life conversation guide for the GP consultation',
    prompt: 'Create a structured End of Life conversation guide for a GP consultation with a frail elderly patient. Include: how to open the conversation sensitively, exploring patient understanding of their condition, eliciting values and preferences, discussing ceiling of treatment, preferred place of death, DNACPR decisions, involving family, documenting decisions, and follow-up. Reference the Gold Standards Framework and Ambitions for Palliative and End of Life Care.',
    icon: Feather,
    gradient: 'from-slate-500 to-gray-600',
  },
  {
    id: 'cohort-logic',
    emoji: '📊',
    shortTitle: 'Ageing Well Cohort Logic',
    title: 'Define cohort logic to identify patients eligible for proactive Ageing Well review',
    prompt: 'Define the clinical cohort logic (SNOMED/Read codes and database query criteria) to identify patients eligible for a proactive Ageing Well review in a GP practice. Include criteria for: age ≥75, eFI ≥ 0.24 (mild frailty+), polypharmacy (≥10 medications), 2+ emergency admissions in 12 months, housebound/care home status, recent bereavement, and living alone. Output as a structured specification suitable for a clinical system search.',
    icon: BarChart3,
    gradient: 'from-green-500 to-emerald-600',
  },
];

export const AgeingWellHomeScreen: React.FC<AgeingWellHomeScreenProps> = ({ setInput, focusInput }) => {
  const { practiceContext, practiceDetails } = usePracticeContext();
  const [showBanner, setShowBanner] = useState(false);

  const enhancePrompt = (prompt: string) => {
    if (!prompt) return prompt;
    let enhanced = prompt;
    if (practiceContext.practiceName && (
      prompt.toLowerCase().includes('practice') ||
      prompt.toLowerCase().includes('patient') ||
      prompt.toLowerCase().includes('letter')
    )) {
      enhanced += `\n\nYOUR PRACTICE DETAILS:\n- Practice Name: ${practiceContext.practiceName}`;
      if (practiceDetails?.address || practiceContext.practiceAddress) {
        enhanced += `\n- Address: ${practiceDetails?.address || practiceContext.practiceAddress}`;
      }
    }
    return enhanced;
  };

  const handlePromptClick = (prompt: string) => {
    setInput(enhancePrompt(prompt));
    setShowBanner(true);
    toast.success('Prompt inserted', {
      description: 'Add patient details below the prompt for best results.',
      duration: 3000,
    });
  };

  return (
    <div className="p-2 sm:p-3">
      <div className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 sm:gap-2 max-w-3xl mx-auto">
          {AGEING_WELL_PROMPTS.map((item, index) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handlePromptClick(item.prompt)}
                  className={cn(
                    "group flex items-center gap-2 p-2.5 relative",
                    "bg-card border border-border rounded-lg",
                    "hover:border-primary/50 hover:bg-accent/50",
                    "transition-all duration-150",
                    "text-left min-w-0 overflow-hidden"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    "bg-gradient-to-br",
                    item.gradient
                  )}>
                    <item.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate pr-1">
                    {item.shortTitle}
                  </span>
                  <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="font-medium text-sm">{item.emoji} {item.title}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {showBanner && (
          <div className="w-full pt-4">
            <ContextBanner onDismiss={() => setShowBanner(false)} role="practice-manager" />
          </div>
        )}
      </div>
    </div>
  );
};
