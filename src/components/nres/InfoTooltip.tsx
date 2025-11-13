import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface InfoTooltipProps {
  content: string;
  className?: string;
}

export const InfoTooltip = ({ content, className = "" }: InfoTooltipProps) => {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Info className={`h-4 w-4 text-muted-foreground hover:text-foreground cursor-help transition-colors ${className}`} />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-sm bg-popover text-popover-foreground border shadow-md">
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
