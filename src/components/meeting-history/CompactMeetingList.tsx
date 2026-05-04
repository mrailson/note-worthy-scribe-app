import { format } from "date-fns";
import { Clock, Eye, Trash2, Calendar, Video, Users, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { NewMeetingBadge } from "./NewMeetingBadge";
import { MeetingProgressBadges } from "./MeetingProgressBadges";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  notes_generation_status?: string | null;
  notes_email_sent_at?: string | null;
  remote_chunk_paths?: string[] | null;
  mixed_audio_url?: string | null;
}

interface CompactMeetingListProps {
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
    'team_meeting': 'Team',
    'one_on_one': '1:1',
    'project_update': 'Project',
    'brainstorm': 'Brainstorm',
    'interview': 'Interview',
    'client_call': 'Client',
    'workshop': 'Workshop',
    'training': 'Training',
    'all_hands': 'All Hands',
    'standup': 'Standup',
    'retrospective': 'Retro',
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

export const CompactMeetingList = ({
  meetings,
  isSelectMode = false,
  selectedMeetings = [],
  onSelectMeeting,
  onViewNotes,
  onDelete,
  loading = false
}: CompactMeetingListProps) => {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
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
    <TooltipProvider delayDuration={200}>
      <div className="space-y-1">
        {/* Header row */}
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border/50">
          {isSelectMode && <div className="w-5" />}
          <div>Title</div>
          <div className="w-24 text-center hidden sm:block">Date</div>
          <div className="w-16 text-center hidden md:block">Type</div>
          <div className="w-16 text-center hidden lg:block">Duration</div>
          <div className="w-20 text-center">Status</div>
          <div className="w-20 text-right">Actions</div>
        </div>

        {/* Meeting rows */}
        {meetings.map((meeting) => {
          const FormatIcon = getFormatIcon(meeting.meeting_format);
          const isSelected = selectedMeetings.includes(meeting.id);
          
          return (
            <div
              key={meeting.id}
              className={cn(
                "group grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-4 py-3 rounded-lg transition-colors",
                "hover:bg-muted/50 border border-transparent hover:border-border/50",
                isSelected && "bg-primary/5 border-primary/20"
              )}
            >
              {isSelectMode && (
                <div className="flex items-center">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => onSelectMeeting?.(meeting.id, !!checked)}
                  />
                </div>
              )}
              
              {/* Title with format icon */}
              <div className="flex items-center gap-2 min-w-0 flex-col sm:flex-row sm:items-center items-start">
                <div className="flex items-center gap-2 min-w-0">
                  <FormatIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-medium text-sm leading-snug break-words line-clamp-2 cursor-help" title={meeting.title}>
                        {meeting.title}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md">{meeting.title}</TooltipContent>
                  </Tooltip>
                  <NewMeetingBadge createdAt={meeting.created_at} />
                </div>
                <MeetingProgressBadges meeting={meeting} className="shrink-0" />
              </div>
              
              {/* Date */}
              <div className="w-24 text-center text-sm text-muted-foreground hidden sm:flex items-center justify-center">
                {format(new Date(meeting.start_time), 'd MMM yyyy')}
              </div>
              
              {/* Type badge */}
              <div className="w-16 hidden md:flex items-center justify-center">
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                  {getMeetingTypeLabel(meeting.meeting_type).slice(0, 8)}
                </Badge>
              </div>
              
              {/* Duration */}
              <div className="w-16 text-center text-sm text-muted-foreground hidden lg:flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" />
                {meeting.duration_minutes ? `${meeting.duration_minutes}m` : '-'}
              </div>
              
              {/* Status */}
              <div className="w-20 flex items-center justify-center">
                <Badge 
                  variant={meeting.status === 'completed' ? 'default' : 'secondary'}
                  className={cn(
                    "text-xs px-1.5 py-0 h-5",
                    meeting.status === 'completed' && "bg-success/10 text-success border-success/20"
                  )}
                >
                  {meeting.status === 'completed' ? 'Done' : meeting.status}
                </Badge>
              </div>
              
              {/* Actions */}
              <div className="w-20 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onViewNotes(meeting.id)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View Notes</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onDelete(meeting.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </div>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
};
