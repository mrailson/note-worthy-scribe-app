import React, { useState } from 'react';
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
  ExternalLink,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { imageSubCategories, customImagePrompt, type ImageSubCategory, type ImageDetailPrompt } from './pmImagePrompts';

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
  hasSubMenu?: boolean;
}

type ActiveView = 
  | { type: 'main' }
  | { type: 'image-categories' }
  | { type: 'image-details'; category: ImageSubCategory };

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
    hasSubMenu: true,
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
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'main' });

  const enhancePrompt = (prompt: string) => {
    if (!prompt) return prompt;
    
    const isVisualPrompt = 
      prompt.toLowerCase().includes('create a professional nhs-style image') ||
      prompt.toLowerCase().includes('create an image') ||
      prompt.toLowerCase().includes('generate an image') ||
      prompt.toLowerCase().includes('infographic') ||
      prompt.toLowerCase().includes('presentation') ||
      prompt.toLowerCase().includes('powerpoint') ||
      prompt.toLowerCase().includes('slides');
    
    if (isVisualPrompt) return prompt;
    
    let enhanced = prompt;
    
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

  const showPromptInsertedToast = () => {
    toast.success('Prompt inserted', {
      description: 'Add more details to get better results. You can upload, paste or drag documents to provide context.',
      duration: 4000,
    });
  };

  const handleCardClick = (useCase: UseCase) => {
    if (useCase.hasSubMenu && useCase.id === 'image') {
      setActiveView({ type: 'image-categories' });
    } else if (useCase.focusOnly) {
      focusInput?.();
    } else {
      setInput(enhancePrompt(useCase.prompt));
      showPromptInsertedToast();
    }
  };

  const handleImageCategoryClick = (category: ImageSubCategory) => {
    if (category.prompts.length === 0) {
      setInput(customImagePrompt);
      setActiveView({ type: 'main' });
      showPromptInsertedToast();
    } else {
      setActiveView({ type: 'image-details', category });
    }
  };

  const handleDetailPromptClick = (detailPrompt: ImageDetailPrompt) => {
    setInput(detailPrompt.prompt);
    setActiveView({ type: 'main' });
    showPromptInsertedToast();
  };

  const handleBack = () => {
    if (activeView.type === 'image-details') {
      setActiveView({ type: 'image-categories' });
    } else {
      setActiveView({ type: 'main' });
    }
  };

  const renderCard = (
    id: string,
    shortTitle: string,
    title: string,
    description: string,
    Icon: React.ElementType,
    gradient: string,
    onClick: () => void
  ) => (
    <Tooltip key={id}>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "group flex items-center gap-2 p-2.5",
            "bg-card border border-border rounded-lg",
            "hover:border-primary/50 hover:bg-accent/50",
            "transition-all duration-150",
            "text-left min-w-0 overflow-hidden"
          )}
        >
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            "bg-gradient-to-br",
            gradient
          )}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate">
            {shortTitle}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </TooltipContent>
    </Tooltip>
  );

  const renderSimpleCard = (
    id: string,
    shortTitle: string,
    Icon: React.ElementType,
    gradient: string,
    onClick: () => void
  ) => (
    <button
      key={id}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2 p-2.5",
        "bg-card border border-border rounded-lg",
        "hover:border-primary/50 hover:bg-accent/50",
        "transition-all duration-150",
        "text-left min-w-0 overflow-hidden"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
        "bg-gradient-to-br",
        gradient
      )}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate">
        {shortTitle}
      </span>
    </button>
  );

  return (
    <div className="p-3 sm:p-4">
      <div className="space-y-3">
        {activeView.type === 'main' ? (
          <>
            <TooltipProvider delayDuration={200}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-2xl mx-auto">
                {useCases.map((useCase) => 
                  renderCard(
                    useCase.id,
                    useCase.shortTitle,
                    useCase.title,
                    useCase.description,
                    useCase.icon,
                    useCase.gradient,
                    () => handleCardClick(useCase)
                  )
                )}
              </div>
            </TooltipProvider>

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
          </>
        ) : activeView.type === 'image-categories' ? (
          <div className="space-y-3 max-w-2xl mx-auto">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to main menu</span>
            </button>
            
            <div className="flex items-center gap-2 justify-center">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <ImageIcon className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-medium text-foreground">What type of image?</h3>
            </div>
            
            <TooltipProvider delayDuration={200}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {imageSubCategories.map((category) => 
                  renderCard(
                    category.id,
                    category.shortTitle,
                    category.shortTitle,
                    category.description,
                    category.icon,
                    category.gradient,
                    () => handleImageCategoryClick(category)
                  )
                )}
              </div>
            </TooltipProvider>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to image types</span>
            </button>
            
            <div className="flex items-center gap-2 justify-center">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                "bg-gradient-to-br",
                activeView.category.gradient
              )}>
                <activeView.category.icon className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-medium text-foreground">{activeView.category.shortTitle}</h3>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activeView.category.prompts.map((detailPrompt) => 
                renderSimpleCard(
                  detailPrompt.id,
                  detailPrompt.shortTitle,
                  activeView.category.icon,
                  activeView.category.gradient,
                  () => handleDetailPromptClick(detailPrompt)
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
