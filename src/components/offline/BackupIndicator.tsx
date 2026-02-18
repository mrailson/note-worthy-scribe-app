import React from 'react';
import { Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface BackupIndicatorProps {
  isActive: boolean;
  segmentCount: number;
}

export const BackupIndicator: React.FC<BackupIndicatorProps> = ({ isActive, segmentCount }) => {
  if (!isActive) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="px-1.5">
            <Shield className="h-3 w-3" />
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          Backup active{segmentCount > 1 ? ` · Segment ${segmentCount}` : ''}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
