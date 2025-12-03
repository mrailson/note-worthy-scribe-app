import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

interface ProcessingMetricsProps {
  patient: {
    images_count: number;
    upload_started_at?: string | null;
    upload_completed_at?: string | null;
    ocr_started_at?: string | null;
    ocr_completed_at?: string | null;
    pdf_started_at?: string | null;
    pdf_completed_at?: string | null;
  };
}

function calculateDuration(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (isNaN(startTime) || isNaN(endTime)) return null;
  return (endTime - startTime) / 1000; // seconds
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toFixed(0)}s`;
}

function formatSecondsPerPage(seconds: number, pageCount: number): string {
  if (pageCount <= 0) return '-';
  const perPage = seconds / pageCount;
  return `${perPage.toFixed(1)} sec/page`;
}

export function LGProcessingMetrics({ patient }: ProcessingMetricsProps) {
  const uploadDuration = calculateDuration(patient.upload_started_at, patient.upload_completed_at);
  const ocrDuration = calculateDuration(patient.ocr_started_at, patient.ocr_completed_at);
  const pdfDuration = calculateDuration(patient.pdf_started_at, patient.pdf_completed_at);

  const totalDuration = [uploadDuration, ocrDuration, pdfDuration]
    .filter((d): d is number => d !== null)
    .reduce((a, b) => a + b, 0);

  const hasAnyMetrics = uploadDuration !== null || ocrDuration !== null || pdfDuration !== null;

  if (!hasAnyMetrics) {
    return null;
  }

  const pageCount = patient.images_count || 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Processing Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {uploadDuration !== null && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Upload:</span>
              <span className="font-medium font-mono">
                {formatDuration(uploadDuration)}
                <span className="text-muted-foreground ml-2">
                  ({formatSecondsPerPage(uploadDuration, pageCount)})
                </span>
              </span>
            </div>
          )}
          
          {ocrDuration !== null && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">OCR:</span>
              <span className="font-medium font-mono">
                {formatDuration(ocrDuration)}
                <span className="text-muted-foreground ml-2">
                  ({formatSecondsPerPage(ocrDuration, pageCount)})
                </span>
              </span>
            </div>
          )}
          
          {pdfDuration !== null && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">PDF Creation:</span>
              <span className="font-medium font-mono">
                {formatDuration(pdfDuration)}
                <span className="text-muted-foreground ml-2">
                  ({formatSecondsPerPage(pdfDuration, pageCount)})
                </span>
              </span>
            </div>
          )}
          
          {totalDuration > 0 && (
            <>
              <hr className="my-2 border-border" />
              <div className="flex justify-between items-center font-medium">
                <span>Total:</span>
                <span className="font-mono">{formatDuration(totalDuration)}</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
