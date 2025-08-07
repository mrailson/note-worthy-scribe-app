import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Share2, Eye, Download, User } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SharedMeetingBadgeProps {
  accessType: 'owner' | 'shared';
  accessLevel?: 'view' | 'download';
  sharedBy?: string;
  sharedAt?: string;
  shareMessage?: string;
}

export function SharedMeetingBadge({ 
  accessType, 
  accessLevel, 
  sharedBy, 
  sharedAt, 
  shareMessage 
}: SharedMeetingBadgeProps) {
  if (accessType === 'owner') {
    return (
      <Badge variant="secondary" className="text-xs">
        <User className="h-3 w-3 mr-1" />
        My Meeting
      </Badge>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const tooltipContent = (
    <div className="space-y-1">
      <p><strong>Shared by:</strong> {sharedBy || 'Unknown'}</p>
      <p><strong>Shared on:</strong> {sharedAt ? formatDate(sharedAt) : 'Unknown'}</p>
      <p><strong>Access:</strong> {accessLevel === 'download' ? 'Full Access' : 'View Only'}</p>
      {shareMessage && (
        <p><strong>Message:</strong> {shareMessage}</p>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-xs cursor-help">
            <Share2 className="h-3 w-3 mr-1" />
            Shared
            {accessLevel === 'download' ? (
              <Download className="h-3 w-3 ml-1" />
            ) : (
              <Eye className="h-3 w-3 ml-1" />
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}