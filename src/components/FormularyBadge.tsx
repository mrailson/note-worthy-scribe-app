import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Info, ShoppingCart, Star, List, Pill } from 'lucide-react';

export type FormularyStatus = 'preferred' | 'listed' | 'otc' | 'none';

interface FormularyBadgeProps {
  status: FormularyStatus;
  onClick?: () => void;
  className?: string;
}

const statusDescriptions: Record<FormularyStatus, string> = {
  preferred: "Northamptonshire Formulary: local preferred choice(s) for primary care. Always check Traffic-Light restrictions.",
  listed: "Listed in Northamptonshire Formulary but not preferred. Consider preferred alternatives first.",
  otc: "Available over-the-counter. May be appropriate for patient purchase.",
  none: "Not found in local formulary. Check alternative options or seek specialist advice."
};

const getStatusConfig = (status: FormularyStatus) => {
  switch (status) {
    case 'preferred':
      return {
        className: 'bg-[#2E7D32] hover:bg-[#1B5E20] text-white border-[#2E7D32]',
        icon: <Star className="w-3 h-3" />,
        label: 'Formulary: Preferred'
      };
    case 'listed':
      return {
        className: 'bg-[#546E7A] hover:bg-[#455A64] text-white border-[#546E7A]',
        icon: <List className="w-3 h-3" />,
        label: 'Formulary: Listed'
      };
    case 'otc':
      return {
        className: 'bg-[#FB8C00] hover:bg-[#F57C00] text-white border-[#FB8C00]',
        icon: <ShoppingCart className="w-3 h-3" />,
        label: 'OTC'
      };
    case 'none':
    default:
      return {
        className: 'bg-gray-400 hover:bg-gray-500 text-white border-gray-400',
        icon: <Pill className="w-3 h-3" />,
        label: 'Not Listed'
      };
  }
};

export const FormularyBadge: React.FC<FormularyBadgeProps> = ({ 
  status, 
  onClick, 
  className = ''
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<'left' | 'center' | 'right'>('center');
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const config = getStatusConfig(status);
  const description = statusDescriptions[status];
  const formularyUrl = "https://www.icnorthamptonshire.org.uk/mo-formulary";
  
  const showTooltip = () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      setHideTimeout(null);
    }
    setIsTooltipVisible(true);
    
    // Calculate optimal position to prevent overflow
    if (buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const tooltipWidth = 320; // 80 * 4 (w-80 = 20rem = 320px)
      const viewportWidth = window.innerWidth;
      
      // Calculate centered position
      const centeredLeft = buttonRect.left + buttonRect.width / 2 - tooltipWidth / 2;
      
      // Check if tooltip would overflow left or right (more conservative)
      if (centeredLeft < 50) {
        // Too close to left edge, align tooltip to left with larger margin
        setTooltipPosition('left');
      } else if (centeredLeft + tooltipWidth > viewportWidth - 50) {
        // Too close to right edge, align tooltip to right  
        setTooltipPosition('right');
      } else {
        // Safe to center
        setTooltipPosition('center');
      }
    }
  };
  
  const hideTooltip = () => {
    const timeout = setTimeout(() => {
      setIsTooltipVisible(false);
    }, 100); // Small delay to allow moving to tooltip
    setHideTimeout(timeout);
  };
  
  const handleTooltipEnter = () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      setHideTimeout(null);
    }
  };
  
  const handleTooltipLeave = () => {
    setIsTooltipVisible(false);
  };
  
  return (
    <span className="relative inline-flex items-center">
      <button
        ref={buttonRef}
        className={`
          inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold 
          cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[#005EB8] focus:ring-offset-2
          ${config.className} ${className}
        `}
        onClick={onClick}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
          if (e.key === 'Escape') {
            setIsTooltipVisible(false);
          }
        }}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        tabIndex={0}
        aria-describedby={`formulary-tip-${status}`}
        aria-label={`${config.label} formulary status`}
      >
        {config.icon}
        <span className="truncate max-w-32">{config.label}</span>
      </button>

      {/* Tooltip */}
      {isTooltipVisible && (
        <div
          role="tooltip"
          id={`formulary-tip-${status}`}
          className="pointer-events-auto absolute z-50 mt-2 w-80 rounded-xl border bg-white p-3 text-sm shadow-lg
                     opacity-100 transition-opacity duration-150 visible"
          style={{ 
            top: '100%',
            left: tooltipPosition === 'left' ? '20px' : 
                  tooltipPosition === 'right' ? 'auto' : '50%',
            right: tooltipPosition === 'right' ? '20px' : 'auto',
            transform: tooltipPosition === 'center' ? 'translateX(-50%)' : 'none'
          }}
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
        >
          <div className="mb-2 flex items-center gap-2 text-[#2E7D32]">
            <Info className="h-4 w-4" aria-hidden />
            <strong>ICN Formulary</strong>
          </div>
          <p className="text-gray-700 mb-3">{description}</p>

          <div>
            <a
              href={formularyUrl}
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#2E7D32] hover:underline"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open ICN Formulary
            </a>
          </div>
        </div>
      )}
    </span>
  );
};

export default FormularyBadge;