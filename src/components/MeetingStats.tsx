import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, FileText } from "lucide-react";
import { MeetingData } from "@/types/meetingTypes";

interface MeetingStatsProps {
  meetingData: MeetingData | null;
}

export const MeetingStats: React.FC<MeetingStatsProps> = ({ meetingData }) => {
  console.log('MeetingStats received meetingData:', meetingData);
  if (!meetingData) return null;

  const formatDuration = (duration: string | undefined) => {
    console.log('formatDuration called with:', duration, typeof duration);
    if (!duration) {
      console.log('Duration is falsy, returning 0:00');
      return '0:00';
    }
    if (duration.includes(':')) return duration;
    return `${duration}:00`;
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-4 justify-center">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Duration:</span>
            <Badge variant="secondary">{formatDuration(meetingData.duration)}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Words:</span>
            <Badge variant="secondary">{(meetingData.wordCount || 0).toLocaleString()}</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Speakers:</span>
            <Badge variant="secondary">{meetingData.speakerCount || 0}</Badge>
          </div>
          
          {meetingData.startTime && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Started:</span>
              <Badge variant="outline">
                {new Date(meetingData.startTime).toLocaleString()}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};