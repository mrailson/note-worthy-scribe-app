import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface BackupLiveTranscriptionCardProps {
  transcriptText: string;
  isRecording: boolean;
}

export const BackupLiveTranscriptionCard: React.FC<BackupLiveTranscriptionCardProps> = ({
  transcriptText,
  isRecording,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const wordCount = transcriptText.split(' ').filter(w => w.trim()).length;

  return (
    <Card className="border-accent/30 bg-card/95">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <span className="text-2xl">🔄</span>
                Backup Transcription Service
              </CardTitle>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
            <span>Words: {wordCount}</span>
            {isRecording && (
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Active
              </span>
            )}
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div 
              className="bg-muted/20 p-4 rounded-lg text-sm leading-relaxed min-h-[120px] max-h-[400px] overflow-y-auto"
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
                  {isRecording ? 'Listening for backup transcription...' : 'No backup transcription available'}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
