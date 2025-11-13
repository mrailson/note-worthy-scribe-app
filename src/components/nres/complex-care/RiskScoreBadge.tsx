import { Badge } from "@/components/ui/badge";
import { InfoTooltip } from "../InfoTooltip";
import { cn } from "@/lib/utils";

interface RiskScoreBadgeProps {
  score: number;
  size?: 'small' | 'medium' | 'large';
}

export const RiskScoreBadge = ({ score, size = 'medium' }: RiskScoreBadgeProps) => {
  const getScoreConfig = () => {
    if (score >= 95) {
      return {
        label: `${score}/100`,
        className: 'bg-[#DC143C] text-white border-[#DC143C] hover:bg-[#DC143C]/90',
        tooltip: 'CRITICAL (95-100): Immediate intervention required. Multiple high-risk factors present.',
        pulse: true,
      };
    } else if (score >= 85) {
      return {
        label: `${score}/100`,
        className: 'bg-[#FF4500] text-white border-[#FF4500] hover:bg-[#FF4500]/90',
        tooltip: 'HIGH PRIORITY (85-94): Urgent review needed. Escalating risk factors detected.',
        pulse: false,
      };
    } else if (score >= 75) {
      return {
        label: `${score}/100`,
        className: 'bg-[#FF8C00] text-white border-[#FF8C00] hover:bg-[#FF8C00]/90',
        tooltip: 'ELEVATED (75-84): Active monitoring required. Moderate risk factors present.',
        pulse: false,
      };
    } else {
      return {
        label: `${score}/100`,
        className: 'bg-[#28a745] text-white border-[#28a745] hover:bg-[#28a745]/90',
        tooltip: 'WELL MANAGED (<75): Stable under current care plan.',
        pulse: false,
      };
    }
  };

  const config = getScoreConfig();
  
  const sizeClasses = {
    small: 'text-xs px-2 py-0.5',
    medium: 'text-sm px-3 py-1',
    large: 'text-base px-4 py-1.5 font-bold',
  };

  return (
    <div className="flex items-center gap-1.5">
      <Badge 
        className={cn(
          config.className,
          sizeClasses[size],
          config.pulse && 'animate-pulse',
          'font-semibold'
        )}
      >
        {config.label}
      </Badge>
      <InfoTooltip content={config.tooltip} />
    </div>
  );
};
