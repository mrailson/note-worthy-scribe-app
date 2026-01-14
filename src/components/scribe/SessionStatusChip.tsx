import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SessionStatus } from "@/utils/clinicalHeadlineGenerator";

interface SessionStatusChipProps {
  status: SessionStatus;
  className?: string;
}

const STATUS_CONFIG: Record<SessionStatus, {
  label: string;
  colorClass: string;
  dotColor: string;
}> = {
  reviewed: {
    label: 'Reviewed',
    colorClass: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-200 dark:border-green-800',
    dotColor: 'bg-green-500',
  },
  followUpDue: {
    label: 'Follow-up due',
    colorClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
    dotColor: 'bg-yellow-500',
  },
  actionPending: {
    label: 'Action pending',
    colorClass: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
  },
  draft: {
    label: 'Draft',
    colorClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    dotColor: 'bg-slate-400',
  },
};

export function SessionStatusChip({ status, className }: SessionStatusChipProps) {
  const config = STATUS_CONFIG[status];
  
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium py-0.5 px-2 flex items-center gap-1.5",
        config.colorClass,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dotColor)} />
      {config.label}
    </Badge>
  );
}
