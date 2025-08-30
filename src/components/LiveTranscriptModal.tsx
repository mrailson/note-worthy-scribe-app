import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className={
          isMobile 
            ? "!fixed !inset-0 !transform-none !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none !max-h-none !m-0 !rounded-none !border-0 flex flex-col"
            : "max-w-4xl w-[95vw] h-[90vh] max-h-[800px] flex flex-col"
        }
        style={isMobile ? {
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          transform: 'none',
          margin: 0,
          borderRadius: 0,
          border: 'none'
        } : {}}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Eye className="w-5 h-5" />
            Live Transcript - Full View
          </DialogTitle>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Words: {wordCount}</span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                Live
              </span>
            </div>
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
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto bg-muted/20 p-4 rounded-lg text-sm leading-relaxed font-mono"
            style={{
              // Ensure smooth scrolling on all devices including iPhone
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
      </DialogContent>
    </Dialog>
  );
};