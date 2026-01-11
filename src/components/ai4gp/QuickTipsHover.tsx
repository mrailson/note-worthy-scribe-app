import React from 'react';
import { 
  HelpCircle,
  Eraser,
  Mic,
  MicOff,
  Upload,
  Clipboard,
  Keyboard,
  Stethoscope,
  ClipboardList,
  MessageSquarePlus
} from 'lucide-react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';

interface QuickTip {
  icon: React.ElementType;
  title: string;
  description: string;
  shortcut?: string;
}

const quickTips: QuickTip[] = [
  {
    icon: Mic,
    title: 'Voice Input',
    description: 'Click the microphone to dictate your query. Click again to stop.',
    shortcut: undefined
  },
  {
    icon: Eraser,
    title: 'Clear Input',
    description: 'Click the eraser icon in the text box to clear your text.',
    shortcut: 'Esc'
  },
  {
    icon: Upload,
    title: 'Upload Files',
    description: 'Drag & drop files onto the input area, or click the + button to attach.',
  },
  {
    icon: Clipboard,
    title: 'Paste Screenshots',
    description: 'Paste images directly into the chat (Ctrl/Cmd+V) for instant analysis.',
  },
  {
    icon: ClipboardList,
    title: 'Insert Details',
    description: 'Type something first, then click the clipboard icon to add practice details.',
  },
  {
    icon: Keyboard,
    title: 'Quick Send',
    description: 'Press Ctrl+Enter (or Cmd+Enter on Mac) to send your message.',
    shortcut: 'Ctrl+Enter'
  },
  {
    icon: Stethoscope,
    title: 'Clinical Mode',
    description: 'Toggle clinical mode for enhanced medical source verification.',
  },
  {
    icon: MessageSquarePlus,
    title: 'New Chat',
    description: 'Click the + button to start a fresh conversation.',
  },
];

export const QuickTipsHover: React.FC = () => {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5",
            "text-sm text-muted-foreground hover:text-primary",
            "border border-border rounded-lg hover:border-primary/50 hover:bg-accent/30",
            "transition-all duration-150"
          )}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Quick Tips</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent 
        side="top" 
        align="center" 
        className="w-80 p-0"
        sideOffset={8}
      >
        <div className="p-3 border-b bg-muted/30">
          <p className="font-medium text-sm">Quick Tips</p>
          <p className="text-xs text-muted-foreground">Helpful shortcuts and features</p>
        </div>
        <div className="p-2 max-h-64 overflow-y-auto space-y-1">
          {quickTips.map((tip, index) => {
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
