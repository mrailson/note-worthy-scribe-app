import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/nres/InfoTooltip";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommsMetricCardProps {
  title: string;
  value: number;
  tooltip: string;
  variant: 'default' | 'success' | 'warning' | 'danger';
  trend?: number;
  onClick?: () => void;
}

export const CommsMetricCard = ({ 
  title, 
  value, 
  tooltip, 
  variant, 
  trend,
  onClick 
}: CommsMetricCardProps) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'border-[#007F3B] hover:border-[#007F3B]/80 hover:shadow-md';
      case 'warning':
        return 'border-[#FFB81C] hover:border-[#FFB81C]/80 hover:shadow-md';
      case 'danger':
        return 'border-[#DA291C] hover:border-[#DA291C]/80 hover:shadow-md';
      default:
        return 'border-border hover:border-[#005EB8]/30 hover:shadow-md';
    }
  };

  const getValueColor = () => {
    switch (variant) {
      case 'success':
        return 'text-[#007F3B]';
      case 'warning':
        return 'text-[#92400e]';
      case 'danger':
        return 'text-[#DA291C]';
      default:
        return 'text-foreground';
    }
  };

  const getTrendIcon = () => {
    if (!trend || trend === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-[#007F3B]" />;
    return <TrendingDown className="h-4 w-4 text-[#DA291C]" />;
  };

  const getTrendText = () => {
    if (!trend || trend === 0) return 'No change';
    const absChange = Math.abs(trend);
    return trend > 0 ? `+${absChange} this week` : `${trend} this week`;
  };

  return (
    <Card 
      className={cn(
        "transition-all duration-200 border-2",
        getVariantStyles(),
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          <InfoTooltip content={tooltip} />
        </div>
        
        <div className="flex items-baseline gap-2 mb-2">
          <span className={cn("text-4xl font-bold", getValueColor())}>
            {value}
          </span>
        </div>

        {trend !== undefined && (
          <div className="flex items-center gap-1.5 text-sm">
            {getTrendIcon()}
            <span className="text-muted-foreground">{getTrendText()}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
