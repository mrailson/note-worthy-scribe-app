import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, CheckCircle, Stethoscope, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type PolicyStatus = 'DOUBLE_RED' | 'RED' | 'SPECIALIST_INITIATED' | 'SPECIALIST_RECOMMENDED' | 'GREY' | 'UNKNOWN';

interface PolicyBadgeProps {
  status: PolicyStatus;
  medicineName?: string;
  onClick?: () => void;
  className?: string;
}

const getStatusConfig = (status: PolicyStatus) => {
  switch (status) {
    case 'DOUBLE_RED':
      return {
        className: 'bg-[#C62828] hover:bg-[#B71C1C] text-white border-[#C62828]',
        icon: <AlertTriangle className="w-3 h-3" />,
        label: 'Double Red',
        tooltip: 'Hospital-only. Do not prescribe in primary care.'
      };
    case 'RED':
      return {
        className: 'bg-[#E53935] hover:bg-[#D32F2F] text-white border-[#E53935]',
        icon: <Shield className="w-3 h-3" />,
        label: 'Red',
        tooltip: 'Do not initiate in primary care; specialist pathway or PA.'
      };
    case 'SPECIALIST_INITIATED':
      return {
        className: 'bg-[#6A1B9A] hover:bg-[#4A148C] text-white border-[#6A1B9A]',
        icon: <Stethoscope className="w-3 h-3" />,
        label: 'Specialist-Initiated',
        tooltip: 'Primary care may continue once started by specialist.'
      };
    case 'SPECIALIST_RECOMMENDED':
      return {
        className: 'bg-[#1565C0] hover:bg-[#0D47A1] text-white border-[#1565C0]',
        icon: <CheckCircle className="w-3 h-3" />,
        label: 'Specialist-Recommended',
        tooltip: 'Consider as recommended option; check formulary.'
      };
    case 'GREY':
    case 'UNKNOWN':
    default:
      return {
        className: 'bg-[#546E7A] hover:bg-[#455A64] text-white border-[#546E7A]',
        icon: <HelpCircle className="w-3 h-3" />,
        label: 'Unknown',
        tooltip: 'Not assessed locally; confirm with Medicines Optimisation.'
      };
  }
};

export const PolicyBadge: React.FC<PolicyBadgeProps> = ({ 
  status, 
  medicineName, 
  onClick, 
  className 
}) => {
  const config = getStatusConfig(status);
  
  const badge = (
    <Badge
      variant="outline"
      className={`
        inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold 
        cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
        ${config.className} ${className}
      `}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${config.label} policy status${medicineName ? ` for ${medicineName}` : ''}`}
    >
      {config.icon}
      <span className="truncate max-w-24">{config.label}</span>
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default PolicyBadge;