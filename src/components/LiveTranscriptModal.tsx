import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Eye } from 'lucide-react';
import { toast } from 'sonner';

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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-none h-[100dvh] md:max-w-4xl md:w-[95vw] md:h-[90vh] md:max-h-[800px] flex flex-col p-4 md:p-6 m-0 md:m-auto inset-0 md:inset-auto translate-x-0 translate-y-0 md:translate-x-[-50%] md:translate-y-[-50%] rounded-none md:rounded-lg">
        <DialogHeader>
          <DialogTitle className="sr-only">Live Transcript</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};