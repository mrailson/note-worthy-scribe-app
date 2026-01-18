import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import { format } from "date-fns";
import { TranscriptDisplay } from "./TranscriptDisplay";

type TranscriptSource = 'batch' | 'realtime';

interface TranscriptComparisonViewProps {
  batchTranscript: string;
  realtimeTranscript?: string;
  createdAt: string;
  copyToClipboard: (text: string, label: string) => void;
}

export const TranscriptComparisonView = ({
  batchTranscript,
  realtimeTranscript,
  createdAt,
  copyToClipboard
}: TranscriptComparisonViewProps) => {
  const [source, setSource] = useState<TranscriptSource>('batch');
  const hasRealtime = !!realtimeTranscript?.trim();
  
  const currentTranscript = source === 'batch' ? batchTranscript : (realtimeTranscript || '');
  const sourceLabel = source === 'batch' ? 'Whisper (Batch)' : 'Notewell (Live)';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Recorded on {format(new Date(createdAt), "EEEE, d MMMM yyyy 'at' HH:mm")}
          </p>
          {hasRealtime && (
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant={source === 'batch' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSource('batch')}
                className="h-7 text-xs"
              >
                Whisper
              </Button>
              <Button
                variant={source === 'realtime' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSource('realtime')}
                className="h-7 text-xs"
              >
                Notewell
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasRealtime && (
            <Badge variant="outline" className="text-xs">
              {sourceLabel}
            </Badge>
          )}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => copyToClipboard(currentTranscript, `${sourceLabel} Transcript`)}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
        </div>
      </div>
      <ScrollArea className="h-[400px] rounded-xl border bg-gradient-to-b from-amber-50/50 to-white dark:from-slate-900/50 dark:to-slate-950 shadow-inner">
        <TranscriptDisplay transcript={currentTranscript} />
      </ScrollArea>
      {!hasRealtime && (
        <p className="text-xs text-muted-foreground text-center">
          Live transcript comparison not available for this session
        </p>
      )}
    </div>
  );
};
