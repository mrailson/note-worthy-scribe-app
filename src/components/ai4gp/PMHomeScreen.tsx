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
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            What would you like to do today?
          </h2>
          <p className="text-sm text-muted-foreground">
            Select an option below or type your own question
          </p>
        </div>

        {/* Use Case Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {useCases.map((useCase) => {
            const Icon = useCase.icon;
            return (
              <button
                key={useCase.id}
                onClick={() => handleCardClick(useCase)}
                className={cn(
                  "group relative flex flex-col items-start p-4 sm:p-5",
                  "bg-card border border-border rounded-xl",
                  "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
                  "transition-all duration-200 ease-out",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  "text-left"
                )}
              >
                {/* Icon Container */}
                <div className={cn(
                  "w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3",
                  "bg-gradient-to-br shadow-sm",
                  useCase.gradient
                )}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>

                {/* Text Content */}
                <h3 className="font-semibold text-foreground text-sm sm:text-base mb-1 group-hover:text-primary transition-colors">
                  {useCase.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                  {useCase.description}
                </p>

                {/* Subtle hover indicator */}
                <div className={cn(
                  "absolute inset-0 rounded-xl border-2 border-primary opacity-0",
                  "group-hover:opacity-100 transition-opacity pointer-events-none"
                )} />
              </button>
            );
          })}
        </div>

        {/* Tip Footer */}
        <p className="text-center text-xs text-muted-foreground">
          💡 Tip: You can also upload documents, images, or audio files to analyse
        </p>
      </div>
    </div>
  );
};
