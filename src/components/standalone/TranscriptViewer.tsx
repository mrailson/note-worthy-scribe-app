import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Sparkles } from 'lucide-react';

interface TranscriptViewerProps {
  transcript: string;
  cleanedTranscript: string;
  showCleaned: boolean;
  cleaningEnabled: boolean;
  onToggleView: () => void;
  isTranscribing: boolean;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  transcript,
  cleanedTranscript,
  showCleaned,
  cleaningEnabled,
  onToggleView,
  isTranscribing
}) => {
  const [isVisible, setIsVisible] = React.useState(true);
  const displayTranscript = showCleaned && cleaningEnabled ? cleanedTranscript : transcript;

  if (!isVisible) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Button
            onClick={() => setIsVisible(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            Show Transcript
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Transcript</h3>
          
          {cleaningEnabled && (
            <div className="flex items-center gap-2">
              <Button
                onClick={onToggleView}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {showCleaned ? 'Show Original' : 'Show Cleaned'}
              </Button>
              
              <Badge variant={showCleaned ? "default" : "secondary"}>
                {showCleaned ? 'NHS Cleaned' : 'Original'}
              </Badge>
            </div>
          )}
        </div>

        <Button
          onClick={() => setIsVisible(false)}
          variant="outline"
          size="sm"
        >
          <EyeOff className="h-4 w-4" />
        </Button>
      </div>

      {/* Transcript Content */}
      <div className="min-h-[200px] max-h-[400px] overflow-y-auto">
        {displayTranscript ? (
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap text-foreground leading-relaxed">
              {displayTranscript}
              {isTranscribing && (
                <span className="inline-block w-2 h-5 bg-primary ml-1 animate-pulse" />
              )}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            <div className="text-center">
              <p className="text-lg mb-2">No transcript yet</p>
              <p className="text-sm">Start recording to see transcription here</p>
            </div>
          </div>
        )}
      </div>

      {/* Word Count */}
      {displayTranscript && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Words: {displayTranscript.trim().split(/\s+/).filter(w => w.length > 0).length}
            </span>
            <span>
              Characters: {displayTranscript.length}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};