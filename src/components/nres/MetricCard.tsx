import { Card } from "@/components/ui/card";
import { InfoTooltip } from "./InfoTooltip";
import { TrendingUp, TrendingDown, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  tooltip: string;
  trend?: 'up' | 'down' | 'stable';
  variant?: 'default' | 'success' | 'warning' | 'danger';
  icon?: React.ReactNode;
  onClick?: () => void;
  pulse?: boolean;
}

export const MetricCard = ({ 
  title, 
  value, 
  subtitle, 
  tooltip, 
  trend, 
  variant = 'default',
  icon,
  onClick,
  pulse = false
}: MetricCardProps) => {
  const variantStyles = {
    default: 'border-border hover:border-[#005EB8]',
    success: 'border-[#007F3B] bg-[#007F3B]/5',
    warning: 'border-[#FFB81C] bg-[#FFB81C]/5',
    danger: 'border-[#DA291C] bg-[#DA291C]/5'
  };

  const valueColors = {
    default: 'text-[#003087]',
    success: 'text-[#007F3B]',
    warning: 'text-[#ED8B00]',
    danger: 'text-[#DA291C]'
  };

  return (
    <Card 
      className={cn(
        'p-6 transition-all hover:shadow-lg border-2',
        variantStyles[variant],
        onClick && 'cursor-pointer',
        pulse && 'animate-pulse'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <InfoTooltip content={tooltip} />
      </div>
      
      <div className="flex items-center gap-3 mb-2">
        {icon && <div className="text-[#005EB8]">{icon}</div>}
        <div className={cn('text-5xl font-bold', valueColors[variant])}>
          {value}
        </div>
      </div>

      {subtitle && (
        <p className="text-sm text-muted-foreground mb-2">{subtitle}</p>
      )}

      {trend && (
        <div className="flex items-center gap-1 text-sm">
          {trend === 'up' ? (
            <>
              <TrendingUp className="h-4 w-4 text-[#007F3B]" />
              <span className="text-[#007F3B]">Improving</span>
            </>
          ) : trend === 'down' ? (
            <>
              <TrendingDown className="h-4 w-4 text-[#DA291C]" />
              <span className="text-[#DA291C]">Needs attention</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-[#005EB8]" />
              <span className="text-[#005EB8]">Stable</span>
            </>
          )}
        </div>
      )}
    </Card>
  );
};
