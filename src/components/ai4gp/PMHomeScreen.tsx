import React from 'react';
import { 
  FileText, 
  ImageIcon, 
  Volume2, 
  Mic, 
  MessageSquare, 
  QrCode, 
  Languages, 
  Presentation, 
  Search, 
  Sparkles 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePracticeContext } from '@/hooks/usePracticeContext';

interface PMHomeScreenProps {
  setInput: (text: string) => void;
  focusInput?: () => void;
}

interface UseCase {
  id: string;
  title: string;
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
    description: 'Upload any wordy NHS document and get a concise summary',
    icon: FileText,
    gradient: 'from-blue-500 to-blue-600',
    prompt: 'Please summarise this document concisely, highlighting key points, decisions, and any actions required. Focus on what matters most for a GP practice.',
  },
  {
    id: 'image',
    title: 'Create an Image',
    description: 'Generate posters, social graphics, and patient notices',
    icon: ImageIcon,
    gradient: 'from-purple-500 to-purple-600',
    prompt: 'Create a professional NHS-style image for my practice. I want:',
  },
  {
    id: 'voice',
    title: 'Generate Voice Audio',
    description: 'Turn any script into a downloadable MP3',
    icon: Volume2,
    gradient: 'from-green-500 to-green-600',
    prompt: 'Create an audio file from the following script. Use a clear, professional British voice:\n\n',
  },
  {
    id: 'meeting',
    title: 'Meeting Notes from Audio',
    description: 'Transcribe recordings into structured meeting notes',
    icon: Mic,
    gradient: 'from-orange-500 to-orange-600',
    prompt: 'Please transcribe and summarise this meeting audio into structured notes with key decisions, actions, and attendees clearly identified.',
  },
  {
    id: 'response',
    title: 'Draft a Response',
    description: 'Create complaint responses, letters, and emails',
    icon: MessageSquare,
    gradient: 'from-red-500 to-red-600',
    prompt: 'Help me draft a professional NHS response. Include appropriate letterhead using my practice details. The situation is:',
  },
  {
    id: 'qrcode',
    title: 'Create a QR Code',
    description: 'Generate QR codes for any link or resource',
    icon: QrCode,
    gradient: 'from-teal-500 to-teal-600',
    prompt: 'Generate a QR code for the following URL:',
  },
  {
    id: 'translate',
    title: 'Translate a Document',
    description: 'Translate patient information into 50+ languages',
    icon: Languages,
    gradient: 'from-indigo-500 to-indigo-600',
    prompt: 'Translate the following document/text into [specify language]. Maintain formatting and professional tone:\n\n',
  },
  {
    id: 'presentation',
    title: 'Create a Presentation',
    description: 'Build PowerPoint slides for meetings',
    icon: Presentation,
    gradient: 'from-amber-500 to-amber-600',
    prompt: 'Create a PowerPoint presentation on the following topic for my practice:',
  },
  {
    id: 'search',
    title: 'Search NHS Guidance',
    description: 'Find PCN DES specs, contracts, CQC requirements',
    icon: Search,
    gradient: 'from-cyan-500 to-cyan-600',
    prompt: 'Find the latest NHS guidance on:',
  },
  {
    id: 'anything',
    title: 'Ask Anything',
    description: 'Get AI assistance with any practice question',
    icon: Sparkles,
    gradient: 'from-primary to-primary/80',
    prompt: '',
    focusOnly: true,
  },
];

export const PMHomeScreen: React.FC<PMHomeScreenProps> = ({ setInput, focusInput }) => {
  const { practiceContext, practiceDetails } = usePracticeContext();

  // Enhance prompt with practice context where relevant
  const enhancePrompt = (prompt: string) => {
    if (!prompt) return prompt;
    
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
        {/* Compact Header */}
        <p className="text-center text-sm text-muted-foreground">
          What would you like to do today?
        </p>

        {/* Compact Cards Grid - Full Width */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {useCases.map((useCase) => {
            const Icon = useCase.icon;
            return (
              <button
                key={useCase.id}
                onClick={() => handleCardClick(useCase)}
                className={cn(
                  "group flex items-center gap-2 p-2.5",
                  "bg-card border border-border rounded-lg",
                  "hover:border-primary/50 hover:bg-accent/50",
                  "transition-all duration-150",
                  "text-left"
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

                {/* Text - Title only for compact view */}
                <span className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {useCase.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
