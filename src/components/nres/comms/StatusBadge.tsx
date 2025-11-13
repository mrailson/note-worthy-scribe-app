import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: 'on-track' | 'at-risk' | 'off-track';
  showLabel?: boolean;
}

export const StatusBadge = ({ status, showLabel = true }: StatusBadgeProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'on-track':
        return {
          label: 'On Track',
          className: 'bg-[#d1fae5] text-[#065f46] border-[#007F3B] hover:bg-[#d1fae5]/80',
        };
      case 'at-risk':
        return {
          label: 'At Risk',
          className: 'bg-[#fef3c7] text-[#92400e] border-[#FFB81C] hover:bg-[#fef3c7]/80',
        };
      case 'off-track':
        return {
          label: 'Off Track',
          className: 'bg-[#fee2e2] text-[#991b1b] border-[#DA291C] hover:bg-[#fee2e2]/80',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge className={cn(config.className, "font-semibold")}>
      {showLabel ? config.label : null}
    </Badge>
  );
};
