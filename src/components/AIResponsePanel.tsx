import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { SafeMessageRenderer } from './SafeMessageRenderer';
import { Copy, Sparkles, Maximize2, X } from 'lucide-react';

interface AIResponsePanelProps {
  response: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy: () => void;
}

export const AIResponsePanel: React.FC<AIResponsePanelProps> = ({
  response,
  isOpen,
  onOpenChange,
  onCopy
}) => {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[1000px] sm:w-[1500px] lg:w-[2000px] max-w-[90vw]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            AI Assistant Response
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onCopy}
              className="flex-none"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Response
            </Button>
          </div>
          
          <ScrollArea className="h-[calc(100vh-120px)] pr-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div className="ai-response-content space-y-4 p-4 bg-muted/30 rounded-lg border">
                <SafeMessageRenderer content={response} />
              </div>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
};