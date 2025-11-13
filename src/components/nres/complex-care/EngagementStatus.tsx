import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EngagementStatus as EngagementStatusType } from "@/types/complexCareTypes";
import { cn } from "@/lib/utils";

interface EngagementStatusProps {
  status: EngagementStatusType;
}

export const EngagementStatus = ({ status }: EngagementStatusProps) => {
  const getStatusConfig = () => {
    switch (status.color) {
      case 'green':
        return {
          dotColor: 'bg-[#28a745]',
          textColor: 'text-[#28a745]',
          tooltip: 'Active: Patient engaged and appointment scheduled or recently reviewed',
        };
      case 'amber':
        return {
          dotColor: 'bg-[#ffc107]',
          textColor: 'text-[#ffc107]',
          tooltip: 'Pending: Contacted patient, awaiting response or action',
        };
      case 'red':
        return {
          dotColor: 'bg-[#DC143C]',
          textColor: 'text-[#DC143C]',
          tooltip: 'Declined: Patient not responding, DNA, or refused contact',
        };
      default:
        return {
          dotColor: 'bg-gray-400',
          textColor: 'text-gray-600',
          tooltip: 'Status unknown',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            <div className={cn("h-3 w-3 rounded-full", config.dotColor, status.color === 'green' && 'animate-pulse')} />
            <span className={cn("text-sm font-medium", config.textColor)}>
              {status.message}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{config.tooltip}</p>
          {status.lastContact && (
            <p className="text-xs text-muted-foreground mt-1">
              Last contact: {status.lastContact.toLocaleDateString('en-GB')}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
