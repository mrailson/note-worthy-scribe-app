import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Copy } from 'lucide-react';
import { showToast } from '@/utils/toastWrapper';

interface TranscriptEntry {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: Date;
  confidence?: number;
  service: string;
}

interface TranscriptModalProps {
  title: string;
  fullTranscript: string;
  transcripts: TranscriptEntry[];
  color: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TranscriptModal: React.FC<TranscriptModalProps> = ({
  title,
  fullTranscript,
  transcripts,
  color,
  isOpen,
  onOpenChange,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content is added
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [fullTranscript, isOpen]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(fullTranscript);
      showToast.success('Transcript copied to clipboard', { section: 'meeting_manager' });
    } catch (error) {
      showToast.error('Failed to copy transcript', { section: 'meeting_manager' });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] max-h-[800px] flex flex-col">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${color}`}>
            <FileText className="w-5 h-5" />
            {title} - Full Transcript
          </DialogTitle>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Segments: {transcripts.length}</span>
              <span>Words: {fullTranscript.split(' ').filter(w => w.trim()).length}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              disabled={!fullTranscript}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Full Transcript Section */}
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Complete Transcript</h3>
            <div 
              ref={scrollRef}
              className="h-[200px] overflow-y-auto bg-muted/20 p-4 rounded-lg text-sm leading-relaxed"
              style={{
                // Ensure smooth scrolling on all devices including iPhone
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {fullTranscript ? (
                <div className="whitespace-pre-wrap">
                  {fullTranscript}
                </div>
              ) : (
                <div className="text-muted-foreground italic">
                  No transcript available yet...
                </div>
              )}
            </div>
          </div>

          {/* Segments Section */}
          <div className="flex-1 min-h-0">
            <h3 className="text-sm font-medium mb-2">Transcript Segments</h3>
            <div 
              className="h-full overflow-y-auto bg-muted/10 rounded-lg"
              style={{
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {transcripts.length > 0 ? (
                <div className="space-y-2 p-3">
                  {transcripts.map((transcript, index) => (
                    <div
                      key={transcript.id}
                      className="p-3 bg-background/80 rounded-lg border border-border/50"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge 
                          variant={transcript.isFinal ? "default" : "secondary"} 
                          className="text-xs"
                        >
                          {transcript.isFinal ? "Final" : "Partial"}
                        </Badge>
                        {transcript.confidence !== undefined && (
                          <Badge variant="outline" className="text-xs">
                            {(transcript.confidence * 100).toFixed(0)}%
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatTime(transcript.timestamp)}
                        </span>
                      </div>
                      <div className="text-sm">
                        {transcript.text}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground italic">
                  No transcript segments available yet...
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};