import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, HardDrive, FileWarning, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ProcessingMetricsProps {
  patient: {
    images_count: number;
    upload_started_at?: string | null;
    upload_completed_at?: string | null;
    ocr_started_at?: string | null;
    ocr_completed_at?: string | null;
    summary_started_at?: string | null;
    summary_completed_at?: string | null;
    pdf_started_at?: string | null;
    pdf_completed_at?: string | null;
    // Compression fields
    pdf_final_size_mb?: number | null;
    compression_tier?: 'Standard' | 'Aggressive' | 'Tier 1' | 'Tier 2' | null;
    pdf_split?: boolean;
    pdf_parts?: number;
    compression_attempts?: number;
    original_size_mb?: number | null;
    pdf_part_urls?: string[] | null;
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
  // Round to nearest 0.5 second
  const rounded = Math.round(seconds * 2) / 2;
  if (rounded < 60) {
    return `${rounded.toFixed(1)}s`;
  }
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}m ${secs.toFixed(1)}s`;
}

function formatTimestamp(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  // Format as HH:mm:ss
  return date.toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatSecondsPerPage(seconds: number, pageCount: number): string {
  if (pageCount <= 0) return '-';
  const perPage = seconds / pageCount;
  // Round to nearest 0.5 second
  const rounded = Math.round(perPage * 2) / 2;
  return `${rounded.toFixed(1)} sec/page`;
}

export function LGProcessingMetrics({ patient }: ProcessingMetricsProps) {
  const uploadDuration = calculateDuration(patient.upload_started_at, patient.upload_completed_at);
  const ocrDuration = calculateDuration(patient.ocr_started_at, patient.ocr_completed_at);
  const summaryDuration = calculateDuration(patient.summary_started_at, patient.summary_completed_at);
  const pdfDuration = calculateDuration(patient.pdf_started_at, patient.pdf_completed_at);

  const totalDuration = [uploadDuration, ocrDuration, summaryDuration, pdfDuration]
    .filter((d): d is number => d !== null)
    .reduce((a, b) => a + b, 0);

  const hasAnyMetrics = uploadDuration !== null || ocrDuration !== null || summaryDuration !== null || pdfDuration !== null;

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
        <div className="space-y-3 text-sm">
          {/* Total Pages */}
          {pageCount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Pages:</span>
              <span className="font-medium font-mono">{pageCount}</span>
            </div>
          )}
          
          {/* Upload Timing */}
          {(patient.upload_started_at || patient.upload_completed_at) && (
            <div className="space-y-1">
              <div className="flex justify-between items-center text-muted-foreground text-xs">
                <span>Upload Start:</span>
                <span className="font-mono">{formatTimestamp(patient.upload_started_at) || '—'}</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground text-xs">
                <span>Upload Complete:</span>
                <span className="font-mono">{formatTimestamp(patient.upload_completed_at) || '—'}</span>
              </div>
              {uploadDuration !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Upload Duration:</span>
                  <span className="font-medium font-mono">
                    {formatDuration(uploadDuration)}
                    <span className="text-muted-foreground ml-2">
                      ({formatSecondsPerPage(uploadDuration, pageCount)})
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}
          
          {/* OCR Timing */}
          {(patient.ocr_started_at || patient.ocr_completed_at) && (
            <>
              <hr className="border-border" />
              <div className="space-y-1">
                <div className="flex justify-between items-center text-muted-foreground text-xs">
                  <span>OCR Start:</span>
                  <span className="font-mono">{formatTimestamp(patient.ocr_started_at) || '—'}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground text-xs">
                  <span>OCR Complete:</span>
                  <span className="font-mono">{formatTimestamp(patient.ocr_completed_at) || '—'}</span>
                </div>
                {ocrDuration !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">OCR Duration:</span>
                    <span className="font-medium font-mono">
                      {formatDuration(ocrDuration)}
                      <span className="text-muted-foreground ml-2">
                        ({formatSecondsPerPage(ocrDuration, pageCount)})
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
          
          {/* AI Summary & SNOMED Timing */}
          {(patient.summary_started_at || patient.summary_completed_at) && (
            <>
              <hr className="border-border" />
              <div className="space-y-1">
                <div className="flex justify-between items-center text-muted-foreground text-xs">
                  <span>AI Summary Start:</span>
                  <span className="font-mono">{formatTimestamp(patient.summary_started_at) || '—'}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground text-xs">
                  <span>AI Summary Complete:</span>
                  <span className="font-mono">{formatTimestamp(patient.summary_completed_at) || '—'}</span>
                </div>
                {summaryDuration !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">AI Summary Duration:</span>
                    <span className="font-medium font-mono">
                      {formatDuration(summaryDuration)}
                      <span className="text-muted-foreground ml-2">
                        ({formatSecondsPerPage(summaryDuration, pageCount)})
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
          
          {/* PDF Creation Timing */}
          {(patient.pdf_started_at || patient.pdf_completed_at) && (
            <>
              <hr className="border-border" />
              <div className="space-y-1">
                <div className="flex justify-between items-center text-muted-foreground text-xs">
                  <span>PDF Create Start:</span>
                  <span className="font-mono">{formatTimestamp(patient.pdf_started_at) || '—'}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground text-xs">
                  <span>PDF Ready:</span>
                  <span className="font-mono">{formatTimestamp(patient.pdf_completed_at) || '—'}</span>
                </div>
                {pdfDuration !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">PDF Duration:</span>
                    <span className="font-medium font-mono">
                      {formatDuration(pdfDuration)}
                      <span className="text-muted-foreground ml-2">
                        ({formatSecondsPerPage(pdfDuration, pageCount)})
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
          
          {/* Total */}
          {totalDuration > 0 && (
            <>
              <hr className="border-border" />
              <div className="flex justify-between items-center font-medium">
                <span>Total Processing Time:</span>
                <span className="font-mono">{formatDuration(totalDuration)}</span>
              </div>
            </>
          )}
          
          {/* Compression Metrics */}
          {patient.pdf_final_size_mb !== undefined && patient.pdf_final_size_mb !== null && (
            <>
              <hr className="border-border" />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  PDF Size:
                </span>
                <span className="font-medium font-mono flex items-center gap-2">
                  {patient.pdf_final_size_mb.toFixed(2)} MB
                  {patient.compression_tier && (
                    <Badge variant={patient.compression_tier === 'Standard' || patient.compression_tier === 'Tier 1' ? 'default' : 'secondary'} className="text-xs">
                      {patient.compression_tier}
                    </Badge>
                  )}
                </span>
              </div>
              
              {patient.original_size_mb && patient.original_size_mb > patient.pdf_final_size_mb && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Compression:</span>
                  <span className="text-muted-foreground font-mono">
                    {((1 - patient.pdf_final_size_mb / patient.original_size_mb) * 100).toFixed(0)}% reduction
                    {patient.compression_attempts && patient.compression_attempts > 1 && (
                      <span className="ml-1">({patient.compression_attempts} attempts)</span>
                    )}
                  </span>
                </div>
              )}
              
              {patient.pdf_split && (
                <div className={`flex justify-between items-center ${
                  patient.pdf_part_urls && patient.pdf_part_urls.length > 0 
                    ? 'text-green-600' 
                    : 'text-amber-600'
                }`}>
                  <span className="flex items-center gap-1">
                    {patient.pdf_part_urls && patient.pdf_part_urls.length > 0 ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <FileWarning className="h-3 w-3" />
                    )}
                    {patient.pdf_part_urls && patient.pdf_part_urls.length > 0 
                      ? 'Split Complete:' 
                      : 'Split Required:'}
                  </span>
                  <span className="font-medium">{patient.pdf_parts || 1} parts (each &lt;5MB)</span>
                </div>
              )}
              
              {patient.pdf_final_size_mb <= 5 && (
                <div className="text-xs text-green-600 text-right">
                  ✓ SystmOne compatible
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
