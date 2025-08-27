import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, MapPin, Calendar, ExternalLink } from 'lucide-react';

interface MeetingSettingsDisplayProps {
  meeting: {
    title: string;
    import_source?: string;
    import_source_display?: string;
    meeting_configuration?: any;
    participants?: string[];
    agenda?: string;
    meeting_format?: string;
    start_time?: string;
  };
  compact?: boolean;
}

export const MeetingSettingsDisplay: React.FC<MeetingSettingsDisplayProps> = ({ 
  meeting, 
  compact = false 
}) => {
  const config = meeting.meeting_configuration || {};
  const hasConfig = config.title || config.attendees?.length > 0 || config.agenda;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1 text-xs">
        {meeting.import_source && (
          <Badge variant="outline" className="text-xs">
            <ExternalLink className="h-3 w-3 mr-1" />
            {meeting.import_source_display}
          </Badge>
        )}
        {meeting.participants && meeting.participants.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {meeting.participants.length}
          </Badge>
        )}
        {meeting.agenda && (
          <Badge variant="secondary" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            Agenda
          </Badge>
        )}
        {meeting.meeting_format && (
          <Badge variant="outline" className="text-xs">
            {meeting.meeting_format}
          </Badge>
        )}
      </div>
    );
  }

  if (!hasConfig && !meeting.import_source) {
    return (
      <div className="text-sm text-muted-foreground">
        No meeting configuration available
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Meeting Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {meeting.import_source && (
          <div className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Source:</span>
            <Badge variant="outline">
              {meeting.import_source_display || meeting.import_source}
            </Badge>
          </div>
        )}

        {config.title && config.title !== meeting.title && (
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <span className="text-sm font-medium">Original Title:</span>
              <p className="text-sm text-muted-foreground">{config.title}</p>
            </div>
          </div>
        )}

        {(config.attendees?.length > 0 || meeting.participants?.length > 0) && (
          <div className="flex items-start gap-2">
            <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <span className="text-sm font-medium">Attendees:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {(config.attendees || meeting.participants || []).map((attendee: any, index: number) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {typeof attendee === 'string' ? attendee : attendee.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {config.agenda && (
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <span className="text-sm font-medium">Agenda:</span>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                {config.agenda.substring(0, 200)}
                {config.agenda.length > 200 && '...'}
              </p>
            </div>
          </div>
        )}

        {(config.format || meeting.meeting_format) && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Format:</span>
            <Badge variant="outline">
              {config.format || meeting.meeting_format}
            </Badge>
          </div>
        )}

        {meeting.start_time && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Created:</span>
            <span className="text-sm text-muted-foreground">
              {new Date(meeting.start_time).toLocaleDateString()}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};