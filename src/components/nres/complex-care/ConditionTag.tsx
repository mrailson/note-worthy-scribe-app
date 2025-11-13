import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Condition } from "@/types/complexCareTypes";

interface ConditionTagProps {
  condition: Condition;
  showTooltip?: boolean;
}

export const ConditionTag = ({ condition, showTooltip = true }: ConditionTagProps) => {
  const badge = (
    <Badge 
      style={{ 
        backgroundColor: condition.bgColor,
        color: condition.textColor,
        borderColor: condition.color,
      }}
      className="border font-medium hover:opacity-80 transition-opacity"
    >
      {condition.displayName}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">{condition.name}</p>
          <p className="text-xs text-muted-foreground">{condition.code}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
