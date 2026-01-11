import React from 'react';
import { 
  FileText, 
  ImageIcon, 
  Volume2, 
  Mic, 
  MessageSquare, 
  Presentation, 
  Search, 
  Sparkles,
  LayoutPanelTop,
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

interface PMHomeScreenProps {
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

const useCases: UseCase[] = [
  {
    id: 'summarise',
    title: 'Summarise a Document',
    shortTitle: 'Summarise',
    description: 'Upload any wordy NHS document and get a concise summary',
    icon: FileText,
    gradient: 'from-blue-500 to-blue-600',
    prompt: 'Please summarise this document concisely, highlighting key points, decisions, and any actions required. Focus on what matters most for a GP practice.',
  },
  {
    id: 'image',
    title: 'Create an image',
    shortTitle: 'Image',
    description: 'Generate images just by asking... I am quite the artist!',
    icon: ImageIcon,
    gradient: 'from-purple-500 to-purple-600',
    prompt: 'Create a professional NHS-style image for my practice. I want:',
  },
  {
    id: 'voice',
    title: 'Generate Voice Audio',
    shortTitle: 'Voice',
    description: 'Turn any script into a downloadable MP3',
    icon: Volume2,
    gradient: 'from-green-500 to-green-600',
    prompt: 'Create an audio file from the following script. Use a clear, professional British voice:\n\n',
  },
  {
    id: 'meeting',
    title: 'Meeting Notes from Audio',
    shortTitle: 'Meeting',
    description: 'Transcribe recordings into structured meeting notes',
    icon: Mic,
    gradient: 'from-orange-500 to-orange-600',
    prompt: 'Please transcribe and summarise this meeting audio into structured notes with key decisions, actions, and attendees clearly identified.',
  },
  {
    id: 'response',
    title: 'Draft a Response',
    shortTitle: 'Draft',
    description: 'Create complaint responses, letters, and emails',
    icon: MessageSquare,
    gradient: 'from-red-500 to-red-600',
    prompt: 'Help me draft a professional NHS response. Include appropriate letterhead using my practice details. The situation is:',
  },
  {
    id: 'presentation',
    title: 'Create a Presentation',
    shortTitle: 'Slides',
    description: 'Build PowerPoint slides for meetings (just add your files and let AI do all the work!)',
    icon: Presentation,
    gradient: 'from-amber-500 to-amber-600',
    prompt: 'Create a PowerPoint presentation on the following topic for my practice:',
  },
  {
    id: 'infographic',
    title: 'Create an Infographic',
    shortTitle: 'Infographic',
    description: 'Transform source material into a visual single-page summary',
    icon: LayoutPanelTop,
    gradient: 'from-teal-500 to-teal-600',
    prompt: 'Create a single-page infographic from the following source material. Include key statistics, main points, and visual hierarchy. Make it clear, engaging, and easy to scan at a glance:\n\n',
  },
  {
    id: 'search',
    title: 'Search NHS Guidance',
    shortTitle: 'Search',
    description: 'Find PCN DES specs, contracts, CQC requirements',
    icon: Search,
    gradient: 'from-cyan-500 to-cyan-600',
    prompt: 'Find the latest NHS guidance on:',
  },
  {
    id: 'anything',
    title: 'Ask Anything',
    shortTitle: 'Ask AI',
    description: 'Get AI assistance with any practice question',
    icon: Sparkles,
    gradient: 'from-primary to-primary/80',
    prompt: '',
    focusOnly: true,
  },
];
export const PMHomeScreen: React.FC<PMHomeScreenProps> = ({ setInput, focusInput }) => {
  const { practiceContext, practiceDetails } = usePracticeContext();

  // Enhance prompt with practice context where relevant (but not for image-based prompts)
  const enhancePrompt = (prompt: string) => {
    if (!prompt) return prompt;
    
    // Skip practice details for image-based prompts
    const isImagePrompt = 
      prompt.toLowerCase().includes('create a professional nhs-style image') ||
      prompt.toLowerCase().includes('create an image') ||
      prompt.toLowerCase().includes('generate an image') ||
      prompt.toLowerCase().includes('infographic');
    
    if (isImagePrompt) return prompt;
    
    let enhanced = prompt;
    
    // Add practice details for prompts that need them
    if (practiceContext.practiceName && (
      prompt.toLowerCase().includes('practice') ||
      prompt.toLowerCase().includes('response') ||
      prompt.toLowerCase().includes('letter')
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

        {/* Prompt Guide Link */}
        <div className="flex justify-center pt-2">
          <a
            href="/ai4gp-prompts"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2",
              "text-sm text-muted-foreground hover:text-primary",
              "border border-border rounded-lg hover:border-primary/50 hover:bg-accent/30",
              "transition-all duration-150"
            )}
          >
            <Lightbulb className="w-4 h-4" />
            <span>290 Prompt Ideas</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
