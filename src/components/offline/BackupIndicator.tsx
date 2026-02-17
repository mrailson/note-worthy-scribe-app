import React from 'react';
import { Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BackupIndicatorProps {
  isActive: boolean;
  segmentCount: number;
}

export const BackupIndicator: React.FC<BackupIndicatorProps> = ({ isActive, segmentCount }) => {
  if (!isActive) return null;

  return (
    <Badge variant="secondary" className="gap-1.5 animate-pulse">
      <Shield className="h-3 w-3" />
      <span className="text-xs">
        Backup active{segmentCount > 1 ? ` · Segment ${segmentCount}` : ''}
      </span>
    </Badge>
  );
};
