import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Search, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type QualityGateStatus = 'pending' | 'running' | 'CLEAN' | 'AUTO_CORRECTED' | 'REVIEW_RECOMMENDED' | 'error';

interface QualityGateBadgeProps {
  meetingId: string;
  status?: QualityGateStatus;
  issueCount?: number;
  correctedCount?: number;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  icon: typeof CheckCircle2;
  className: string;
  tooltip: string;
}> = {
  pending: {
    label: 'Pending',
    icon: Loader2,
    className: 'bg-muted text-muted-foreground',
    tooltip: 'Quality gate has not yet run',
  },
  running: {
    label: 'Verifying…',
    icon: Loader2,
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    tooltip: 'Checking minutes against transcript',
  },
  CLEAN: {
    label: 'Verified',
    icon: CheckCircle2,
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    tooltip: 'All claims checked against recording — no issues found',
  },
  AUTO_CORRECTED: {
    label: 'Auto-corrected',
    icon: AlertTriangle,
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    tooltip: '', // dynamic
  },
  REVIEW_RECOMMENDED: {
    label: 'Review recommended',
    icon: Search,
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    tooltip: '', // dynamic
  },
  error: {
    label: 'Gate skipped',
    icon: AlertTriangle,
    className: 'bg-muted text-muted-foreground',
    tooltip: 'Quality gate encountered an error — minutes were not verified',
  },
};

export const QualityGateBadge = ({ meetingId, status, issueCount = 0, correctedCount = 0 }: QualityGateBadgeProps) => {
  // Read from localStorage if no prop provided
  const effectiveStatus: QualityGateStatus = status || 
    (localStorage.getItem(`meeting-qg-status-${meetingId}`) as QualityGateStatus) || 
    'pending';
  
  const storedIssueCount = issueCount || parseInt(localStorage.getItem(`meeting-qg-issues-${meetingId}`) || '0', 10);
  const storedCorrectedCount = correctedCount || parseInt(localStorage.getItem(`meeting-qg-corrected-${meetingId}`) || '0', 10);

  // Don't show badge if gate hasn't run
  if (effectiveStatus === 'pending') return null;

  const config = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.error;
  const Icon = config.icon;
  const isSpinning = effectiveStatus === 'running';

  let tooltipText = config.tooltip;
  if (effectiveStatus === 'AUTO_CORRECTED') {
    tooltipText = `Auto-corrected — ${storedCorrectedCount} item${storedCorrectedCount !== 1 ? 's' : ''} adjusted for accuracy`;
  } else if (effectiveStatus === 'REVIEW_RECOMMENDED') {
    tooltipText = `Review recommended — ${storedIssueCount} item${storedIssueCount !== 1 ? 's' : ''} could not be verified`;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`gap-1 cursor-default text-xs ${config.className}`}>
            <Icon className={`h-3 w-3 ${isSpinning ? 'animate-spin' : ''}`} />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
