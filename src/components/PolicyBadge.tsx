import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Info, AlertTriangle, Shield, Stethoscope, CheckCircle, HelpCircle } from 'lucide-react';

export type PolicyStatus = 'DOUBLE_RED' | 'RED' | 'SPECIALIST_INITIATED' | 'SPECIALIST_RECOMMENDED' | 'AMBER_2' | 'AMBER_1' | 'GREEN' | 'GREY' | 'UNKNOWN';

interface PolicyBadgeProps {
  status: PolicyStatus;
  medicineName?: string;
  onClick?: () => void;
  className?: string;
  detailUrl?: string;
}

const statusDescriptions: Record<PolicyStatus, string> = {
  DOUBLE_RED: "Hospital-only. Do not prescribe in primary care. Follow specialist pathway. Prior Approval/IFR may be required.",
  RED: "Specialist service only. Do not initiate in primary care. Often Blueteq prior approval applies.",
  SPECIALIST_INITIATED: "Continue only after specialist start and when responsibilities are agreed (check letter/shared-care). Do not initiate.",
  SPECIALIST_RECOMMENDED: "Primary care may prescribe when recommended by specialist and criteria met. Check formulary.",
  AMBER_2: "Shared-Care required. Ensure SCP in place and monitoring responsibilities agreed before transfer.",
  AMBER_1: "Primary care prescribing following specialist advice; shared-care not usually required; check criteria.",
  GREEN: "Suitable for primary-care prescribing per local formulary.",
  GREY: "Not routinely commissioned / not assessed. Check with Medicines Optimisation.",
  UNKNOWN: "Local status not found. Verify on ICB site."
};

const getStatusConfig = (status: PolicyStatus) => {
  switch (status) {
    case 'DOUBLE_RED':
      return {
        className: 'bg-[#C62828] hover:bg-[#B71C1C] text-white border-[#C62828]',
        icon: <AlertTriangle className="w-3 h-3" />,
        label: 'Double Red'
      };
    case 'RED':
      return {
        className: 'bg-[#E53935] hover:bg-[#D32F2F] text-white border-[#E53935]',
        icon: <Shield className="w-3 h-3" />,
        label: 'Red'
      };
    case 'SPECIALIST_INITIATED':
      return {
        className: 'bg-[#6A1B9A] hover:bg-[#4A148C] text-white border-[#6A1B9A]',
        icon: <Stethoscope className="w-3 h-3" />,
        label: 'Specialist-Initiated'
      };
    case 'SPECIALIST_RECOMMENDED':
      return {
        className: 'bg-[#1565C0] hover:bg-[#0D47A1] text-white border-[#1565C0]',
        icon: <CheckCircle className="w-3 h-3" />,
        label: 'Specialist-Recommended'
      };
    case 'AMBER_2':
      return {
        className: 'bg-[#EF6C00] hover:bg-[#E65100] text-white border-[#EF6C00]',
        icon: <AlertTriangle className="w-3 h-3" />,
        label: 'Amber 2'
      };
    case 'AMBER_1':
      return {
        className: 'bg-[#FB8C00] hover:bg-[#F57C00] text-white border-[#FB8C00]',
        icon: <AlertTriangle className="w-3 h-3" />,
        label: 'Amber 1'
      };
    case 'GREEN':
      return {
        className: 'bg-[#2E7D32] hover:bg-[#1B5E20] text-white border-[#2E7D32]',
        icon: <CheckCircle className="w-3 h-3" />,
        label: 'Green'
      };
    case 'GREY':
      return {
        className: 'bg-[#546E7A] hover:bg-[#455A64] text-white border-[#546E7A]',
        icon: <HelpCircle className="w-3 h-3" />,
        label: 'Grey'
      };
    case 'UNKNOWN':
    default:
      return {
        className: 'bg-gray-500 hover:bg-gray-600 text-white border-gray-500',
        icon: <HelpCircle className="w-3 h-3" />,
        label: 'Unknown'
      };
  }
};

export const PolicyBadge: React.FC<PolicyBadgeProps> = ({ 
  status, 
  medicineName, 
  onClick, 
  className,
  detailUrl
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const config = getStatusConfig(status);
  const description = statusDescriptions[status];
  const policyUrl = detailUrl || "https://www.icnorthamptonshire.org.uk/trafficlightdrugs";
  
  return (
    <span 
      className="relative inline-flex items-center group"
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
    >
      <button
        className={`
          inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold 
          cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[#005EB8] focus:ring-offset-2
          ${config.className} ${className}
        `}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
          if (e.key === 'Escape') {
            setIsTooltipVisible(false);
          }
        }}
        onFocus={() => setIsTooltipVisible(true)}
        onBlur={() => setIsTooltipVisible(false)}
        tabIndex={0}
        aria-describedby={`tl-tip-${medicineName}-${status}`}
        aria-label={`${config.label} policy status${medicineName ? ` for ${medicineName}` : ''}`}
      >
        {config.icon}
        <span className="truncate max-w-24">{config.label}</span>
      </button>

      {/* Tooltip */}
      {isTooltipVisible && (
        <div
          role="tooltip"
          id={`tl-tip-${medicineName}-${status}`}
          className="pointer-events-auto absolute z-50 mt-8 w-80 rounded-xl border bg-white p-3 text-sm shadow-lg
                     opacity-100 transition-opacity duration-150 visible"
          style={{ top: '100%', left: '50%', transform: 'translateX(-50%)' }}
        >
          <div className="mb-2 flex items-center gap-2 text-[#005EB8]">
            <Info className="h-4 w-4" aria-hidden />
            <strong>Northamptonshire ICB</strong>
          </div>
          <p className="text-gray-700 mb-3">{description}</p>

          <div>
            <a
              href={policyUrl}
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#005EB8] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open ICB policy
            </a>
          </div>
        </div>
      )}
    </span>
  );
};

export default PolicyBadge;