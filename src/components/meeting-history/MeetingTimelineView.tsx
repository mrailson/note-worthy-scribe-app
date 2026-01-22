import { useMemo } from "react";
import { format, isToday, isYesterday, isThisWeek, isThisMonth, startOfDay } from "date-fns";
import { Clock, FileText, Eye, Trash2, Calendar, Video, Users, Monitor, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { NewMeetingBadge } from "./NewMeetingBadge";

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

interface MeetingTimelineViewProps {
  meetings: Meeting[];
  isSelectMode?: boolean;
  selectedMeetings?: string[];
  onSelectMeeting?: (meetingId: string, checked: boolean) => void;
  onViewNotes: (meetingId: string) => void;
  onDelete: (meetingId: string) => void;
  loading?: boolean;
}

interface GroupedMeetings {
  label: string;
  date: Date;
  meetings: Meeting[];
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

const getDateLabel = (date: Date): string => {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date)) return format(date, 'EEEE'); // Day name
  if (isThisMonth(date)) return format(date, 'd MMMM');
  return format(date, 'd MMMM yyyy');
};

export const MeetingTimelineView = ({
  meetings,
  isSelectMode = false,
  selectedMeetings = [],
  onSelectMeeting,
  onViewNotes,
  onDelete,
  loading = false
}: MeetingTimelineViewProps) => {
  // Group meetings by date
  const groupedMeetings = useMemo(() => {
    const groups: Map<string, GroupedMeetings> = new Map();
    
    meetings.forEach((meeting) => {
      const meetingDate = startOfDay(new Date(meeting.start_time));
      const dateKey = meetingDate.toISOString();
      
      if (!groups.has(dateKey)) {
        groups.set(dateKey, {
          label: getDateLabel(meetingDate),
          date: meetingDate,
          meetings: []
        });
      }
      
      groups.get(dateKey)!.meetings.push(meeting);
    });
    
    // Sort groups by date (most recent first)
    return Array.from(groups.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [meetings]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <div className="h-6 w-24 bg-muted/50 rounded animate-pulse" />
            <div className="h-20 bg-muted/50 rounded-lg animate-pulse" />
            <div className="h-20 bg-muted/50 rounded-lg animate-pulse" />
          </div>
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
    <div className="space-y-8">
      {groupedMeetings.map((group, groupIndex) => (
        <div key={group.date.toISOString()} className="relative">
          {/* Date header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-3 mb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                isToday(group.date) 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
              )}>
                <Calendar className="h-3.5 w-3.5" />
                {group.label}
              </div>
              <span className="text-xs text-muted-foreground">
                {group.meetings.length} meeting{group.meetings.length !== 1 ? 's' : ''}
              </span>
              <div className="flex-1 border-t border-border/50" />
            </div>
          </div>

          {/* Timeline connector */}
          <div className="relative pl-6">
            {/* Vertical line */}
            {groupIndex < groupedMeetings.length - 1 && (
              <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border" />
            )}

            {/* Meetings */}
            <div className="space-y-4">
              {group.meetings.map((meeting, meetingIndex) => {
                const FormatIcon = getFormatIcon(meeting.meeting_format);
                const isSelected = selectedMeetings.includes(meeting.id);
                const isLastInGroup = meetingIndex === group.meetings.length - 1;
                
                return (
                  <div
                    key={meeting.id}
                    className="relative group"
                  >
                    {/* Timeline dot */}
                    <div className={cn(
                      "absolute -left-6 top-4 w-3 h-3 rounded-full border-2 border-background z-10",
                      meeting.status === 'completed' 
                        ? "bg-success" 
                        : "bg-muted-foreground"
                    )} />

                    {/* Meeting card */}
                    <div
                      className={cn(
                        "p-4 rounded-lg border border-border/50 transition-all cursor-pointer",
                        "hover:border-border hover:shadow-sm hover:bg-muted/30",
                        isSelected && "ring-2 ring-primary border-primary bg-primary/5"
                      )}
                      onClick={() => onViewNotes(meeting.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Header row */}
                          <div className="flex items-center gap-2 mb-2">
                            {isSelectMode && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => onSelectMeeting?.(meeting.id, !!checked)}
                                />
                              </div>
                            )}
                            
                            <span className="text-sm text-muted-foreground font-medium">
                              {format(new Date(meeting.start_time), 'HH:mm')}
                            </span>
                            
                            <FormatIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            
                            <Badge variant="outline" className="text-xs">
                              {getMeetingTypeLabel(meeting.meeting_type)}
                            </Badge>
                            
                            {meeting.summary_exists && (
                              <FileText className="h-3.5 w-3.5 text-success" />
                            )}
                          </div>

                          {/* Title */}
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-base group-hover:text-primary transition-colors truncate">
                              {meeting.title}
                            </h4>
                            <NewMeetingBadge createdAt={meeting.created_at} />
                          </div>

                          {/* Overview */}
                          {meeting.overview && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {meeting.overview}
                            </p>
                          )}

                          {/* Meta info */}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {meeting.duration_minutes ? `${meeting.duration_minutes} min` : '-'}
                            </div>
                            
                            <Badge 
                              variant="secondary"
                              className={cn(
                                "text-xs h-5",
                                meeting.status === 'completed' && "bg-success/10 text-success"
                              )}
                            >
                              {meeting.status === 'completed' ? 'Completed' : meeting.status}
                            </Badge>
                          </div>
                        </div>

                        {/* Actions */}
                        <div 
                          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onViewNotes(meeting.id)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => onDelete(meeting.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
