import { Badge } from "@/components/ui/badge";
import { InfoTooltip } from "./InfoTooltip";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: 'pending' | 'reviewed' | 'overdue' | 'critical';
  hoursElapsed?: number;
}

export const StatusBadge = ({ status, hoursElapsed }: StatusBadgeProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'critical':
        return {
          label: 'CRITICAL',
          className: 'bg-[#DA291C] text-white border-[#DA291C] hover:bg-[#DA291C]/90',
          tooltip: 'CRITICAL: Result overdue >72 hours. Requires immediate review and has been escalated to Practice Manager.',
          pulse: true
        };
      case 'overdue':
        return {
          label: 'OVERDUE',
          className: 'bg-[#ED8B00] text-white border-[#ED8B00] hover:bg-[#ED8B00]/90',
          tooltip: 'OVERDUE: Result pending for 48-72 hours. Automated reminders have been sent to assigned GP.',
          pulse: false
        };
      case 'reviewed':
        return {
          label: 'REVIEWED',
          className: 'bg-[#007F3B] text-white border-[#007F3B] hover:bg-[#007F3B]/90',
          tooltip: 'REVIEWED: Result has been reviewed by the assigned GP and actioned appropriately.',
          pulse: false
        };
      default:
        return {
          label: 'PENDING',
          className: 'bg-[#005EB8] text-white border-[#005EB8] hover:bg-[#005EB8]/90',
          tooltip: 'PENDING: Result awaiting review within standard timeframe (<48 hours).',
          pulse: false
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center gap-1.5">
      <Badge 
        className={cn(
          config.className,
          config.pulse && 'animate-pulse'
        )}
      >
        {config.label}
        {hoursElapsed && ` (${hoursElapsed}h)`}
      </Badge>
      <InfoTooltip content={config.tooltip} />
    </div>
  );
};
