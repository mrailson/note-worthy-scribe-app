import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Shield, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { PolicyStatus } from './PolicyBadge';

interface PolicyBannerProps {
  status: PolicyStatus;
  medicineName: string;
  detailUrl?: string;
  priorApprovalUrl?: string;
  isEnforced?: boolean;
  onToggleEnforcement?: () => void;
}

const getBannerConfig = (status: PolicyStatus) => {
  switch (status) {
    case 'DOUBLE_RED':
      return {
        icon: <AlertTriangle className="w-4 h-4" />,
        className: 'border-[#C62828] bg-red-50 text-red-800',
        title: 'Local policy: DOUBLE RED',
        message: 'Not for GP prescribing. Use specialist pathway.',
        severity: 'critical' as const
      };
    case 'RED':
      return {
        icon: <Shield className="w-4 h-4" />,
        className: 'border-[#E53935] bg-red-50 text-red-800',
        title: 'Local policy: RED',
        message: 'Do not initiate in primary care. Consider specialist review / PA.',
        severity: 'high' as const
      };
    case 'SPECIALIST_INITIATED':
      return {
        icon: <Shield className="w-4 h-4" />,
        className: 'border-[#6A1B9A] bg-purple-50 text-purple-800',
        title: 'Local policy: Specialist-Initiated',
        message: 'Continue if started by specialist; check shared care.',
        severity: 'medium' as const
      };
    default:
      return {
        icon: <Shield className="w-4 h-4" />,
        className: 'border-amber-400 bg-amber-50 text-amber-800',
        title: 'Local policy guidance',
        message: 'Check local formulary guidance.',
        severity: 'low' as const
      };
  }
};

export const PolicyBanner: React.FC<PolicyBannerProps> = ({
  status,
  medicineName,
  detailUrl,
  priorApprovalUrl,
  isEnforced = true,
  onToggleEnforcement
}) => {
  const config = getBannerConfig(status);

  return (
    <Alert className={`mb-4 ${config.className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          {config.icon}
          <div className="flex-1">
            <AlertDescription className="font-medium">
              <span className="font-semibold">{config.title}</span>
              <span className="mx-2">–</span>
              <span>{config.message}</span>
            </AlertDescription>
            
            <div className="flex items-center gap-2 mt-3">
              {detailUrl && (
                <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                  <a href={detailUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Traffic-Light
                  </a>
                </Button>
              )}
              
              {priorApprovalUrl && (
                <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                  <a href={priorApprovalUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Prior Approval
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>

        {onToggleEnforcement && (
          <div className="flex items-center gap-2 ml-4">
            {!isEnforced && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <EyeOff className="w-3 h-3" />
                <span>Caution mode</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleEnforcement}
              className="h-7 px-2"
              title={isEnforced ? 'Disable enforcement' : 'Enable enforcement'}
            >
              {isEnforced ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </Button>
          </div>
        )}
      </div>
    </Alert>
  );
};

export default PolicyBanner;