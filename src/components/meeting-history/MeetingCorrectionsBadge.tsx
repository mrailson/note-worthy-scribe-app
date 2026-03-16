import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Type } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AppliedCorrection {
  from: string;
  to: string;
}

interface MeetingCorrectionsBadgeProps {
  corrections: AppliedCorrection[];
  onUpdateMeeting?: () => void;
  isUpdating?: boolean;
  compact?: boolean;
}

export const MeetingCorrectionsBadge = ({
  corrections,
  onUpdateMeeting,
  isUpdating = false,
  compact = false,
}: MeetingCorrectionsBadgeProps) => {
  if (corrections.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400 cursor-help"
            >
              <Type className="h-3 w-3 mr-1" />
              {corrections.length} name correction{corrections.length !== 1 ? 's' : ''} available
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium text-xs">Corrections found:</p>
              {corrections.slice(0, 8).map((c, i) => (
                <p key={i} className="text-xs">
                  <span className="line-through text-muted-foreground">{c.from}</span>
                  {' → '}
                  <span className="font-medium">{c.to}</span>
                </p>
              ))}
              {corrections.length > 8 && (
                <p className="text-xs text-muted-foreground">+{corrections.length - 8} more</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {onUpdateMeeting && !compact && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onUpdateMeeting();
            }}
            disabled={isUpdating}
            className="h-6 px-2 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border-amber-500/20 dark:text-amber-400"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating ? 'Updating…' : 'Update This Meeting'}
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
};
