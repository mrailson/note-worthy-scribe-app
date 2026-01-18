import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Copy, FileDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { TranscriptDisplay } from "./TranscriptDisplay";
import { downloadTranscriptComparisonReport, TranscriptComparisonDetails } from "@/utils/transcriptComparisonReport";
import { toast } from "sonner";
import { ConsultationType } from "@/types/scribe";

type TranscriptSource = 'batch' | 'realtime';

interface TranscriptComparisonViewProps {
  batchTranscript: string;
  realtimeTranscript?: string;
  createdAt: string;
  endedAt?: string;
  consultationType?: ConsultationType;
  gpUserName?: string;
  gpQualifications?: string;
  practiceName?: string;
  patientName?: string;
  patientNhsNumber?: string;
  copyToClipboard: (text: string, label: string) => void;
}

export const TranscriptComparisonView = ({
  batchTranscript,
  realtimeTranscript,
  createdAt,
  endedAt,
  consultationType = 'f2f',
  gpUserName = 'Unknown Clinician',
  gpQualifications,
  practiceName,
  patientName,
  patientNhsNumber,
  copyToClipboard
}: TranscriptComparisonViewProps) => {
  const [source, setSource] = useState<TranscriptSource>('batch');
  const [isDownloading, setIsDownloading] = useState(false);
  const hasRealtime = !!realtimeTranscript?.trim();
  
  const currentTranscript = source === 'batch' ? batchTranscript : (realtimeTranscript || '');
  const sourceLabel = source === 'batch' ? 'Notewell Batch' : 'Notewell Live';

  const handleDownloadReport = async () => {
    if (!batchTranscript && !realtimeTranscript) {
      toast.error('No transcripts available to compare');
      return;
    }

    setIsDownloading(true);
    try {
      const consultationDate = format(new Date(createdAt), 'dd/MM/yyyy');
      const consultationStartTime = format(new Date(createdAt), 'HH:mm');
      const consultationEndTime = endedAt ? format(new Date(endedAt), 'HH:mm') : undefined;

      const details: TranscriptComparisonDetails = {
        notewellLiveTranscript: realtimeTranscript || '',
        notewellBatchTranscript: batchTranscript || '',
        consultationDate,
        consultationStartTime,
        consultationEndTime,
        consultationType,
        gpUserName,
        gpQualifications,
        practiceName,
        patientName,
        patientNhsNumber
      };

      await downloadTranscriptComparisonReport(details);
      toast.success('Comparison report downloaded');
    } catch (error) {
      console.error('Failed to download comparison report:', error);
      toast.error('Failed to download report');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Recorded on {format(new Date(createdAt), "EEEE, d MMMM yyyy 'at' HH:mm")}
            {endedAt && ` - ${format(new Date(endedAt), "HH:mm")}`}
          </p>
          {hasRealtime && (
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant={source === 'batch' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSource('batch')}
                className="h-7 text-xs"
              >
                Notewell Batch
              </Button>
              <Button
                variant={source === 'realtime' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSource('realtime')}
                className="h-7 text-xs"
              >
                Notewell Live
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasRealtime && (
            <>
              <Badge variant="outline" className="text-xs">
                {sourceLabel}
              </Badge>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleDownloadReport}
                disabled={isDownloading}
                className="gap-1"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Comparison Report</span>
              </Button>
            </>
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
