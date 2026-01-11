import React from 'react';
import { 
  Info,
  Keyboard,
  FileText,
  Sparkles,
  MessageSquare,
  Upload
} from 'lucide-react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';

interface Tip {
  icon: React.ElementType;
  title: string;
  description: string;
  shortcut?: string;
}

const tips: Tip[] = [
  {
    icon: Keyboard,
    title: 'Send Message',
    description: 'Press to send your message instantly.',
    shortcut: 'Ctrl+Enter'
  },
  {
    icon: Keyboard,
    title: 'Clear Input',
    description: 'Press to clear the text box.',
    shortcut: 'Esc'
  },
  {
    icon: FileText,
    title: 'Be Specific',
    description: 'Always explain what you want with as much detail as possible. The more context you provide, the better the response.',
  },
  {
    icon: Upload,
    title: 'Include Supporting Files',
    description: 'Attach relevant documents, images, or data to help the AI understand your request fully.',
  },
  {
    icon: MessageSquare,
    title: 'Provide Context',
    description: 'Include background information, examples, or specific requirements. When AI guesses, it often guesses wrong.',
  },
  {
    icon: Sparkles,
    title: 'Quality In = Quality Out',
    description: 'Rubbish in equals rubbish out! Well-structured, detailed prompts yield significantly better results.',
  },
];

export const InputTipsHover: React.FC = () => {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center justify-center",
            "p-1.5 rounded-md",
            "text-muted-foreground hover:text-primary",
            "hover:bg-accent/50",
            "transition-all duration-150",
            "focus:outline-none focus:ring-2 focus:ring-primary/20"
          )}
          aria-label="Input tips and keyboard shortcuts"
        >
          <Info className="w-4 h-4" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent 
        side="top" 
        align="end" 
        className="w-80 p-0"
        sideOffset={8}
      >
        <div className="p-3 border-b bg-muted/30">
          <p className="font-medium text-sm">Tips for Better Results</p>
          <p className="text-xs text-muted-foreground">Shortcuts and best practices</p>
        </div>
        <div className="p-2 max-h-72 overflow-y-auto space-y-1">
          {tips.map((tip, index) => {
            const Icon = tip.icon;
            return (
              <div
                key={index}
                className="flex items-start gap-2.5 p-2 rounded-md hover:bg-accent/50 transition-colors"
              >
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground">{tip.title}</p>
                    {tip.shortcut && (
                      <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted border border-border rounded">
                        {tip.shortcut}
                      </kbd>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {tip.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
