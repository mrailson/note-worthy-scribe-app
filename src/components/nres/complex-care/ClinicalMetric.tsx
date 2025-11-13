import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle } from "lucide-react";
import { ClinicalMetric as ClinicalMetricType } from "@/types/complexCareTypes";
import { cn } from "@/lib/utils";

interface ClinicalMetricProps {
  metric: ClinicalMetricType;
}

export const ClinicalMetric = ({ metric }: ClinicalMetricProps) => {
  const getThresholdText = () => {
    if (!metric.threshold) return '';
    
    if (metric.threshold.type === 'above') {
      return `Target: <${metric.threshold.value}${metric.unit}`;
    } else if (metric.threshold.type === 'below') {
      return `Target: >${metric.threshold.value}${metric.unit}`;
    } else if (metric.threshold.type === 'range') {
      const [min, max] = metric.threshold.value as [number, number];
      return `Target: ${min}-${max}${metric.unit}`;
    }
    return '';
  };

  const metricBadge = (
    <Badge 
      className={cn(
        "font-semibold border",
        metric.isAlert 
          ? "bg-[#fee2e2] text-[#991b1b] border-[#991b1b] hover:bg-[#fecaca]" 
          : "bg-[#f3f4f6] text-[#374151] border-[#d1d5db] hover:bg-[#e5e7eb]"
      )}
    >
      <span className="font-medium text-xs">{metric.name}:</span>
      <span className="ml-1">
        {metric.value}
        {metric.unit && metric.unit}
      </span>
      {metric.isAlert && <AlertTriangle className="h-3 w-3 ml-1" />}
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {metricBadge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">{metric.name}</p>
          <p className="text-sm">Current: {metric.value}{metric.unit}</p>
          {metric.threshold && <p className="text-xs text-muted-foreground">{getThresholdText()}</p>}
          {metric.lastRecorded && (
            <p className="text-xs text-muted-foreground mt-1">
              Recorded: {metric.lastRecorded.toLocaleDateString('en-GB')}
            </p>
          )}
          {metric.isAlert && (
            <p className="text-xs font-semibold text-red-600 mt-1">
              ⚠ Outside target range
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
