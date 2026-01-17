import { useState } from "react";
import { format } from "date-fns";
import { Clock, FileText, Eye, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Video, Users, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
}

type SortField = 'title' | 'start_time' | 'duration_minutes' | 'meeting_type' | 'status';
type SortDirection = 'asc' | 'desc';

interface MeetingTableViewProps {
  meetings: Meeting[];
  isSelectMode?: boolean;
  selectedMeetings?: string[];
  onSelectMeeting?: (meetingId: string, checked: boolean) => void;
  onSelectAll?: () => void;
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

export const MeetingTableView = ({
  meetings,
  isSelectMode = false,
  selectedMeetings = [],
  onSelectMeeting,
  onSelectAll,
  onViewNotes,
  onDelete,
  loading = false
}: MeetingTableViewProps) => {
  const [sortField, setSortField] = useState<SortField>('start_time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedMeetings = [...meetings].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'start_time':
        comparison = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
        break;
      case 'duration_minutes':
        comparison = (a.duration_minutes || 0) - (b.duration_minutes || 0);
        break;
      case 'meeting_type':
        comparison = a.meeting_type.localeCompare(b.meeting_type);
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3.5 w-3.5 text-primary" />
      : <ArrowDown className="h-3.5 w-3.5 text-primary" />;
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const allSelected = meetings.length > 0 && selectedMeetings.length === meetings.length;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                {isSelectMode && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={() => onSelectAll?.()}
                    />
                  </TableHead>
                )}
                <TableHead className="min-w-[250px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 -ml-2 font-medium"
                    onClick={() => handleSort('title')}
                  >
                    Title
                    <SortIcon field="title" />
                  </Button>
                </TableHead>
                <TableHead className="w-32">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 -ml-2 font-medium"
                    onClick={() => handleSort('start_time')}
                  >
                    Date
                    <SortIcon field="start_time" />
                  </Button>
                </TableHead>
                <TableHead className="w-28">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 -ml-2 font-medium"
                    onClick={() => handleSort('meeting_type')}
                  >
                    Type
                    <SortIcon field="meeting_type" />
                  </Button>
                </TableHead>
                <TableHead className="w-24">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 -ml-2 font-medium"
                    onClick={() => handleSort('duration_minutes')}
                  >
                    Duration
                    <SortIcon field="duration_minutes" />
                  </Button>
                </TableHead>
                <TableHead className="w-20">Format</TableHead>
                <TableHead className="w-24">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 -ml-2 font-medium"
                    onClick={() => handleSort('status')}
                  >
                    Status
                    <SortIcon field="status" />
                  </Button>
                </TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMeetings.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={isSelectMode ? 8 : 7} 
                    className="h-32 text-center text-muted-foreground"
                  >
                    No meetings found
                  </TableCell>
                </TableRow>
              ) : (
                sortedMeetings.map((meeting) => {
                  const FormatIcon = getFormatIcon(meeting.meeting_format);
                  const isSelected = selectedMeetings.includes(meeting.id);
                  
                  return (
                    <TableRow 
                      key={meeting.id}
                      className={cn(
                        "group cursor-pointer",
                        isSelected && "bg-primary/5"
                      )}
                      onClick={() => onViewNotes(meeting.id)}
                    >
                      {isSelectMode && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => onSelectMeeting?.(meeting.id, !!checked)}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate max-w-[220px]">
                            {meeting.title}
                          </span>
                          {meeting.summary_exists && (
                            <FileText className="h-3.5 w-3.5 text-success shrink-0" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(meeting.start_time), 'd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getMeetingTypeLabel(meeting.meeting_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {meeting.duration_minutes ? `${meeting.duration_minutes}m` : '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger>
                            <FormatIcon className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            {meeting.meeting_format || 'Video call'}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={meeting.status === 'completed' ? 'default' : 'secondary'}
                          className={cn(
                            "text-xs",
                            meeting.status === 'completed' && "bg-success/10 text-success border-success/20"
                          )}
                        >
                          {meeting.status === 'completed' ? 'Done' : meeting.status}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
};
