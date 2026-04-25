import { Info } from "lucide-react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { METHODOLOGY_PATH } from "@/lib/narp-reference";

interface ScoreInfoTooltipProps {
  text: string;
  anchor: string;
  label?: string;
  className?: string;
}

export const ScoreInfoTooltip = ({ text, anchor, label = "Read more", className = "" }: ScoreInfoTooltipProps) => {
  const tooltipId = `score-tip-${anchor}-${text.slice(0, 12).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-describedby={tooltipId}
          aria-label={`${label}: ${text}`}
          className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}
          onClick={(event) => event.stopPropagation()}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent id={tooltipId} className="max-w-[320px] text-xs">
        <div className="space-y-1.5">
          <p>{text}</p>
          <Link
            to={`${METHODOLOGY_PATH}#${anchor}`}
            className="font-medium text-primary underline underline-offset-2"
            onClick={(event) => event.stopPropagation()}
          >
            Read more
          </Link>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
