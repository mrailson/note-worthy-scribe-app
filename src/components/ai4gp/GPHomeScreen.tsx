import React from 'react';
import { 
  BookOpen, 
  Shield, 
  Stethoscope, 
  MessageSquare, 
  CheckSquare, 
  Activity,
  Search, 
  Sparkles,
  Lightbulb,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { QuickTipsHover } from './QuickTipsHover';
interface GPHomeScreenProps {
  setInput: (text: string) => void;
  focusInput?: () => void;
}

interface UseCase {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  prompt: string;
  focusOnly?: boolean;
}

const nhsSafetyPreamble = "You are an expert UK NHS GP assistant. Use only UK primary care sources including NICE guidelines, NHS.uk, BNF, MHRA alerts, the Green Book, and local ICB protocols. Do not use non-UK or non-NHS sources. Present information in concise, GP-friendly bullet points using UK medical terminology.";

const useCases: UseCase[] = [
  {
    id: 'nice',
    title: 'NICE Guidance Finder',
    shortTitle: 'NICE',
    description: 'Find the latest NICE guidance on any condition or topic',
    icon: BookOpen,
    gradient: 'from-blue-500 to-blue-600',
    prompt: nhsSafetyPreamble + '\n\nFind the latest NICE guidance on [medical condition/topic]. Include key recommendations, implementation timeline, and links to full guidance.',
  },
  {
    id: 'bnf',
    title: 'BNF Drug Lookup',
    shortTitle: 'BNF',
    description: 'Comprehensive drug information from the BNF',
    icon: Shield,
    gradient: 'from-green-500 to-green-600',
    prompt: nhsSafetyPreamble + '\n\nProvide comprehensive BNF information for [drug name] including indications, dosing, contraindications, interactions, and monitoring requirements.',
  },
  {
    id: 'case',
    title: 'Tricky Case Check',
    shortTitle: 'Case',
    description: 'Get a clinical case review with differentials and red flags',
    icon: Stethoscope,
    gradient: 'from-purple-500 to-purple-600',
    prompt: 'You are an NHS Clinical Case Review Assistant. Your outputs are for UK healthcare professionals only. Always use UK NHS sources: NICE CKS/Guidelines, BNF, NHS.uk, MHRA Drug Safety Updates, UKHSA Green Book, and local ICB formulary/policies. Never use non-UK sources.\n\nFirst, automatically remove or mask any patient-identifiable information (names, dates of birth, addresses, phone numbers, NHS numbers). Replace with generic placeholders: "the patient", "age X", "relative/friend".\n\nProvide a Brief Review:\n\n• Case recap (anonymised)\n• Top 3 differentials\n• Red/amber flags\n• Key medication/prescribing point\n• Follow-up trigger\n\nDescribe your case:',
  },
  {
    id: 'complaint',
    title: 'Complaint Response Helper',
    shortTitle: 'Complaint',
    description: 'Draft professional NHS complaint responses',
    icon: MessageSquare,
    gradient: 'from-red-500 to-red-600',
    prompt: nhsSafetyPreamble + '\n\nHelp me draft a professional NHS complaint response that acknowledges concerns, explains our position, and outlines next steps. The complaint is about:',
  },
  {
    id: 'qof',
    title: 'QOF Indicator Check',
    shortTitle: 'QOF',
    description: 'Check QOF achievement and improvement guidance',
    icon: CheckSquare,
    gradient: 'from-orange-500 to-orange-600',
    prompt: nhsSafetyPreamble + '\n\nCheck QOF achievement for [indicator] and provide guidance on improving performance and meeting targets.',
  },
  {
    id: 'immunisation',
    title: 'Immunisation Schedule',
    shortTitle: 'Vaccines',
    description: 'UK immunisation schedule from the Green Book',
    icon: Activity,
    gradient: 'from-teal-500 to-teal-600',
    prompt: nhsSafetyPreamble + '\n\nProvide current UK immunisation schedule information for [age group/vaccine] from the Green Book.',
  },
  {
    id: 'search',
    title: 'Search NHS Guidance',
    shortTitle: 'Search',
    description: 'Find policies, MHRA alerts, and prescribing guidance',
    icon: Search,
    gradient: 'from-cyan-500 to-cyan-600',
    prompt: nhsSafetyPreamble + '\n\nFind the latest NHS guidance on:',
  },
  {
    id: 'anything',
    title: 'Ask Anything',
    shortTitle: 'Ask AI',
    description: 'Get AI assistance with any clinical question',
    icon: Sparkles,
    gradient: 'from-primary to-primary/80',
    prompt: '',
    focusOnly: true,
  },
];

export const GPHomeScreen: React.FC<GPHomeScreenProps> = ({ setInput, focusInput }) => {
  const { practiceContext, practiceDetails } = usePracticeContext();

  // Enhance prompt with practice context where relevant
  const enhancePrompt = (prompt: string) => {
    if (!prompt) return prompt;
    
    let enhanced = prompt;
    
    // Add practice details for prompts that need them
    if (practiceContext.practiceName && (
      prompt.toLowerCase().includes('practice') ||
      prompt.toLowerCase().includes('response') ||
      prompt.toLowerCase().includes('complaint')
    )) {
      enhanced += `\n\nYOUR PRACTICE DETAILS:\n- Practice Name: ${practiceContext.practiceName}`;
      if (practiceDetails?.address || practiceContext.practiceAddress) {
        enhanced += `\n- Address: ${practiceDetails?.address || practiceContext.practiceAddress}`;
      }
      if (practiceDetails?.phone || practiceContext.practicePhone) {
        enhanced += `\n- Phone: ${practiceDetails?.phone || practiceContext.practicePhone}`;
      }
      if (practiceDetails?.email || practiceContext.practiceEmail) {
        enhanced += `\n- Email: ${practiceDetails?.email || practiceContext.practiceEmail}`;
      }
    }
    
    return enhanced;
  };

  const handleCardClick = (useCase: UseCase) => {
    if (useCase.focusOnly) {
      focusInput?.();
    } else {
      setInput(enhancePrompt(useCase.prompt));
    }
  };

  return (
    <div className="p-3 sm:p-4">
      <div className="space-y-3">

        {/* Compact Cards Grid - Full Width */}
        <TooltipProvider delayDuration={200}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-2xl mx-auto">
            {useCases.map((useCase) => {
              const Icon = useCase.icon;
              return (
                <Tooltip key={useCase.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleCardClick(useCase)}
                      className={cn(
                        "group flex items-center gap-2 p-2.5",
                        "bg-card border border-border rounded-lg",
                        "hover:border-primary/50 hover:bg-accent/50",
                        "transition-all duration-150",
                        "text-left min-w-0 overflow-hidden"
                      )}
                    >
                      {/* Compact Icon */}
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        "bg-gradient-to-br",
                        useCase.gradient
                      )}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>

                      {/* Short Title */}
                      <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {useCase.shortTitle}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium text-sm">{useCase.title}</p>
                    <p className="text-xs text-muted-foreground">{useCase.description}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* Quick Tips & Prompt Guide Links */}
        <div className="flex items-center justify-center gap-2 pt-2">
          <QuickTipsHover />
          <a
            href="/ai4gp-prompts"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5",
              "text-sm text-muted-foreground hover:text-primary",
              "border border-border rounded-lg hover:border-primary/50 hover:bg-accent/30",
              "transition-all duration-150"
            )}
          >
            <Lightbulb className="w-4 h-4" />
            <span>290 Prompts</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
