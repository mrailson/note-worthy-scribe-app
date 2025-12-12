import { LGPatient } from '@/hooks/useLGCapture';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Upload, 
  Eye, 
  Brain, 
  FileText, 
  Mail, 
  Download, 
  CloudUpload, 
  Archive,
  Check,
  Clock,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LGPipelineStatusDashboardProps {
  patient: LGPatient;
}

interface PipelineStep {
  key: string;
  label: string;
  icon: React.ElementType;
  getTimestamp: (p: LGPatient) => string | null;
  getStartTime?: (p: LGPatient) => string | null;
  getEndTime?: (p: LGPatient) => string | null;
  isComplete: (p: LGPatient) => boolean;
  isCurrent?: (p: LGPatient) => boolean;
}

const formatTime = (dateStr: string | null): string => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
};

const formatDuration = (startStr: string | null, endStr: string | null): string | null => {
  if (!startStr || !endStr) return null;
  try {
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    const diffMs = end - start;
    if (diffMs < 0) return null;
    const seconds = diffMs / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(0);
    return `${minutes}m ${remainingSeconds}s`;
  } catch {
    return null;
  }
};

const pipelineSteps: PipelineStep[] = [
  {
    key: 'uploaded',
    label: 'Uploaded',
    icon: Upload,
    getTimestamp: (p) => p.upload_completed_at,
    getStartTime: (p) => p.upload_started_at,
    getEndTime: (p) => p.upload_completed_at,
    isComplete: (p) => !!p.upload_completed_at,
    isCurrent: (p) => p.job_status === 'uploading',
  },
  {
    key: 'ocr',
    label: 'OCR Complete',
    icon: Eye,
    getTimestamp: (p) => p.ocr_completed_at,
    getStartTime: (p) => p.ocr_started_at,
    getEndTime: (p) => p.ocr_completed_at,
    isComplete: (p) => !!p.ocr_completed_at,
    isCurrent: (p) => p.job_status === 'processing' && !p.ocr_completed_at,
  },
  {
    key: 'summary',
    label: 'AI Summary',
    icon: Brain,
    getTimestamp: (p) => p.processing_completed_at,
    getStartTime: (p) => p.ocr_completed_at,
    getEndTime: (p) => p.processing_completed_at,
    isComplete: (p) => p.job_status === 'succeeded',
    isCurrent: (p) => p.job_status === 'processing' && !!p.ocr_completed_at,
  },
  {
    key: 'pdf',
    label: 'PDF Ready',
    icon: FileText,
    getTimestamp: (p) => p.pdf_completed_at,
    getStartTime: (p) => p.pdf_started_at,
    getEndTime: (p) => p.pdf_completed_at,
    isComplete: (p) => !!p.pdf_completed_at || p.pdf_generation_status === 'complete' || p.pdf_generation_status === 'completed',
    isCurrent: (p) => p.pdf_generation_status === 'generating' || p.pdf_generation_status === 'processing',
  },
  {
    key: 'email',
    label: 'Email Sent',
    icon: Mail,
    getTimestamp: (p) => p.email_sent_at,
    isComplete: (p) => !!p.email_sent_at,
  },
];

// Workflow steps (user actions)
const workflowSteps: PipelineStep[] = [
  {
    key: 'downloaded',
    label: 'Downloaded',
    icon: Download,
    getTimestamp: (p) => (p as any).downloaded_at,
    isComplete: (p) => !!(p as any).downloaded_at,
  },
  {
    key: 'uploaded_s1',
    label: 'Uploaded to S1',
    icon: CloudUpload,
    getTimestamp: (p) => (p as any).uploaded_to_s1_at || (p as any).validated_at,
    isComplete: (p) => !!(p as any).uploaded_to_s1_at || !!(p as any).validated_at,
  },
  {
    key: 'archived',
    label: 'Archived',
    icon: Archive,
    getTimestamp: (p) => (p as any).archived_at,
    isComplete: (p) => !!(p as any).archived_at,
  },
];

function StepIndicator({ 
  step, 
  patient, 
  isLast 
}: { 
  step: PipelineStep; 
  patient: LGPatient; 
  isLast: boolean;
}) {
  const isComplete = step.isComplete(patient);
  const isCurrent = step.isCurrent?.(patient) ?? false;
  const timestamp = step.getTimestamp(patient);
  const duration = step.getStartTime && step.getEndTime 
    ? formatDuration(step.getStartTime(patient), step.getEndTime(patient))
    : null;

  const Icon = step.icon;

  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      {/* Icon circle */}
      <div 
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
          isComplete && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
          isCurrent && !isComplete && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
          !isComplete && !isCurrent && "bg-muted text-muted-foreground"
        )}
      >
        {isComplete ? (
          <Check className="h-4 w-4" />
        ) : isCurrent ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>

      {/* Label */}
      <span className={cn(
        "text-[10px] mt-1 text-center leading-tight",
        isComplete && "text-green-700 dark:text-green-400 font-medium",
        isCurrent && !isComplete && "text-blue-700 dark:text-blue-400 font-medium",
        !isComplete && !isCurrent && "text-muted-foreground"
      )}>
        {step.label}
      </span>

      {/* Timestamp */}
      <span className="text-[9px] text-muted-foreground">
        {formatTime(timestamp)}
      </span>

      {/* Duration */}
      {duration && (
        <span className="text-[9px] text-muted-foreground">
          ({duration})
        </span>
      )}
    </div>
  );
}

function calculateTotalTime(patient: LGPatient): string | null {
  const start = patient.upload_started_at;
  const end = patient.pdf_completed_at || patient.processing_completed_at;
  return formatDuration(start, end);
}

export function LGPipelineStatusDashboard({ patient }: LGPipelineStatusDashboardProps) {
  const totalTime = calculateTotalTime(patient);

  // Check which outputs exist
  const hasOutputs = patient.job_status === 'succeeded';
  const hasPdf = !!patient.pdf_url || (patient.pdf_part_urls && patient.pdf_part_urls.length > 0);
  const hasSummary = !!patient.summary_json_url;
  const hasSnomedJson = !!patient.snomed_json_url;
  const hasSnomedCsv = !!patient.snomed_csv_url;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Processing Pipeline
          </CardTitle>
          {totalTime && (
            <span className="text-xs text-muted-foreground">
              Total: {totalTime}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Processing Pipeline Steps */}
        <div className="flex items-start justify-between gap-1">
          {pipelineSteps.map((step, idx) => (
            <StepIndicator 
              key={step.key} 
              step={step} 
              patient={patient}
              isLast={idx === pipelineSteps.length - 1}
            />
          ))}
        </div>

        {/* Connector line */}
        <div className="relative h-px bg-border mx-4">
          <div 
            className="absolute h-full bg-green-500 transition-all"
            style={{
              width: `${(pipelineSteps.filter(s => s.isComplete(patient)).length / pipelineSteps.length) * 100}%`
            }}
          />
        </div>

        {/* Workflow Steps (user actions) */}
        <div className="flex items-start justify-between gap-1 pt-2 border-t">
          {workflowSteps.map((step, idx) => (
            <StepIndicator 
              key={step.key} 
              step={step} 
              patient={patient}
              isLast={idx === workflowSteps.length - 1}
            />
          ))}
        </div>

        {/* Output Files */}
        {hasOutputs && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t text-xs">
            <span className="text-muted-foreground">Outputs:</span>
            <span className={cn(
              "px-2 py-0.5 rounded",
              hasPdf ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"
            )}>
              PDF {hasPdf ? '✓' : '—'}
            </span>
            <span className={cn(
              "px-2 py-0.5 rounded",
              hasSummary ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"
            )}>
              Summary {hasSummary ? '✓' : '—'}
            </span>
            <span className={cn(
              "px-2 py-0.5 rounded",
              hasSnomedJson ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"
            )}>
              SNOMED {hasSnomedJson ? '✓' : '—'}
            </span>
            <span className={cn(
              "px-2 py-0.5 rounded",
              hasSnomedCsv ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"
            )}>
              CSV {hasSnomedCsv ? '✓' : '—'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
