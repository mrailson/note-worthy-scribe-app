import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Copy, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

interface LiveTranscriptModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transcriptText: string;
}

export const LiveTranscriptModal: React.FC<LiveTranscriptModalProps> = ({
  isOpen,
  onOpenChange,
  transcriptText,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Auto-scroll to bottom when new content is added
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptText, isOpen]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(transcriptText);
      toast.success('Live transcript copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy transcript');
    }
  };

  const wordCount = transcriptText.split(' ').filter(w => w.trim()).length;

  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-red-600 font-semibold">
          <Eye className="w-5 h-5" />
          Live Transcript - Full View
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Words: {wordCount}</span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            Live
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            disabled={!transcriptText}
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-muted/20 p-4 rounded-lg text-sm leading-relaxed font-mono"
          style={{
            WebkitOverflowScrolling: 'touch',
            wordWrap: 'break-word',
            overflowWrap: 'break-word'
          }}
        >
          {transcriptText ? (
            <div className="whitespace-pre-wrap">
              {transcriptText}
            </div>
          ) : (
            <div className="text-muted-foreground italic text-center pt-8">
              Listening… interim speech appears here
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[95vh] flex flex-col">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="sr-only">Live Transcript</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 flex flex-col px-4 pb-4">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] max-h-[800px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="sr-only">Live Transcript</DialogTitle>
        </DialogHeader>
        <div className="flex-1 flex flex-col">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
};