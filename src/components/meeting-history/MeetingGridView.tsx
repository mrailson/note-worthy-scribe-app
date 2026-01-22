import { format } from "date-fns";
import { Clock, FileText, Eye, Trash2, Calendar, Video, Users, Monitor, MoreVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { NewMeetingBadge } from "./NewMeetingBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  meeting_type: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  status: string;
  created_at: string;
  overview?: string | null;
  summary_exists?: boolean;
  word_count?: number;
  meeting_format?: string;
  meeting_location?: string;
}

interface MeetingGridViewProps {
  meetings: Meeting[];
  isSelectMode?: boolean;
  selectedMeetings?: string[];
  onSelectMeeting?: (meetingId: string, checked: boolean) => void;
  onViewNotes: (meetingId: string) => void;
  onDelete: (meetingId: string) => void;
  loading?: boolean;
}

const getMeetingTypeLabel = (type: string): string => {
  const types: Record<string, string> = {
    'team_meeting': 'Team Meeting',
    'one_on_one': '1:1',
    'project_update': 'Project Update',
    'brainstorm': 'Brainstorm',
    'interview': 'Interview',
    'client_call': 'Client Call',
    'workshop': 'Workshop',
    'training': 'Training',
    'all_hands': 'All Hands',
    'standup': 'Standup',
    'retrospective': 'Retrospective',
    'planning': 'Planning',
    'review': 'Review',
    'other': 'Other'
  };
  return types[type] || type.replace(/_/g, ' ');
};

const getFormatIcon = (format?: string) => {
  switch (format) {
    case 'video': return Video;
    case 'in-person':
    case 'face-to-face': return Users;
    case 'hybrid': return Monitor;
    default: return Video;
  }
};

const getMeetingTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    'team_meeting': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    'one_on_one': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    'project_update': 'bg-green-500/10 text-green-600 border-green-500/20',
    'brainstorm': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    'interview': 'bg-pink-500/10 text-pink-600 border-pink-500/20',
    'client_call': 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  };
  return colors[type] || 'bg-muted text-muted-foreground';
};

export const MeetingGridView = ({
  meetings,
  isSelectMode = false,
  selectedMeetings = [],
  onSelectMeeting,
  onViewNotes,
  onDelete,
  loading = false
}: MeetingGridViewProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-48 bg-muted/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="font-medium">No meetings found</p>
        <p className="text-sm">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {meetings.map((meeting) => {
        const FormatIcon = getFormatIcon(meeting.meeting_format);
        const isSelected = selectedMeetings.includes(meeting.id);
        
        return (
          <Card
            key={meeting.id}
            className={cn(
              "group relative overflow-hidden transition-all hover:shadow-md cursor-pointer",
              "border-border/50 hover:border-border",
              isSelected && "ring-2 ring-primary border-primary"
            )}
            onClick={() => onViewNotes(meeting.id)}
          >
            {/* Select checkbox */}
            {isSelectMode && (
              <div 
                className="absolute top-3 left-3 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelectMeeting?.(meeting.id, !!checked)}
                  className="bg-background"
                />
              </div>
            )}

            {/* Actions dropdown */}
            <div 
              className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="icon" className="h-7 w-7">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onViewNotes(meeting.id)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Notes
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onDelete(meeting.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <CardContent className="p-4 pt-4">
              {/* Header with type badge */}
              <div className="flex items-start justify-between mb-3">
                <Badge 
                  variant="outline" 
                  className={cn("text-xs", getMeetingTypeColor(meeting.meeting_type))}
                >
                  {getMeetingTypeLabel(meeting.meeting_type)}
                </Badge>
                {meeting.summary_exists && (
                  <FileText className="h-4 w-4 text-success" />
                )}
              </div>

              {/* Title */}
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-base line-clamp-2 group-hover:text-primary transition-colors">
                  {meeting.title}
                </h3>
                <NewMeetingBadge createdAt={meeting.created_at} />
              </div>

              {/* Overview excerpt */}
              {meeting.overview && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {meeting.overview}
                </p>
              )}

              {/* Meta info */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto pt-2 border-t border-border/50">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(meeting.start_time), 'd MMM')}
                </div>
                
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {meeting.duration_minutes ? `${meeting.duration_minutes}m` : '-'}
                </div>
                
                <div className="flex items-center gap-1">
                  <FormatIcon className="h-3 w-3" />
                </div>

                {/* Status indicator */}
                <div className="ml-auto">
                  <span className={cn(
                    "inline-flex h-2 w-2 rounded-full",
                    meeting.status === 'completed' ? "bg-success" : "bg-muted-foreground"
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
