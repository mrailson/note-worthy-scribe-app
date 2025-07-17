import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  Calendar, 
  FileText, 
  Eye,
  Trash2, 
  Play,
  MessageSquare,
  CheckCircle,
  AlertCircle 
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

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
  transcript_count?: number;
  summary_exists?: boolean;
}

interface MeetingHistoryListProps {
  meetings: Meeting[];
  onEdit: (meetingId: string) => void;
  onViewSummary: (meetingId: string) => void;
  onDelete: (meetingId: string) => void;
  loading: boolean;
}

export const MeetingHistoryList = ({ 
  meetings, 
  onEdit, 
  onViewSummary,
  onDelete, 
  loading 
}: MeetingHistoryListProps) => {
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in-progress':
        return <Play className="h-4 w-4 text-blue-500" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'completed': { variant: 'default' as const, label: 'Completed' },
      'in-progress': { variant: 'secondary' as const, label: 'In Progress' },
      'scheduled': { variant: 'outline' as const, label: 'Scheduled' },
      'cancelled': { variant: 'destructive' as const, label: 'Cancelled' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['scheduled'];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getMeetingTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'general': 'General Meeting',
      'team-meeting': 'Team Meeting',
      'clinical-review': 'Clinical Review',
      'training': 'Training Session',
    };
    return types[type] || type.charAt(0).toUpperCase() + type.slice(1);
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'No duration';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const generateOverview = (meeting: Meeting) => {
    const words = [];
    
    // Add meeting type
    words.push(getMeetingTypeLabel(meeting.meeting_type));
    
    // Add date
    words.push('on', format(new Date(meeting.start_time), 'MMM d, yyyy'));
    
    // Add duration if available
    if (meeting.duration_minutes) {
      words.push('lasting', formatDuration(meeting.duration_minutes));
    }
    
    // Add status context
    const statusContext = {
      'completed': 'successfully completed',
      'in-progress': 'currently in progress',
      'scheduled': 'scheduled for the future',
      'cancelled': 'was cancelled'
    };
    words.push('and', statusContext[meeting.status as keyof typeof statusContext] || 'is scheduled');
    
    // Add description excerpt if available
    if (meeting.description) {
      const descWords = meeting.description.split(' ').slice(0, 15);
      words.push('-', ...descWords);
    }
    
    // Add transcript/summary info
    if (meeting.transcript_count) {
      words.push('with', meeting.transcript_count.toString(), 'transcript entries');
    }
    if (meeting.summary_exists) {
      words.push('and summary available');
    }
    
    // Limit to 40 words
    return words.slice(0, 40).join(' ');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No meetings found</h3>
          <p className="text-muted-foreground mb-4">
            Start by creating your first meeting or adjust your search criteria.
          </p>
          <Button onClick={() => window.location.href = '/'}>
            Create First Meeting
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {meetings.map((meeting) => (
        <Card key={meeting.id} className="hover:shadow-medium transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusIcon(meeting.status)}
                  <h3 className="font-semibold text-lg">{meeting.title}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {getMeetingTypeLabel(meeting.meeting_type)}
                  </Badge>
                  {getStatusBadge(meeting.status)}
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(meeting.start_time), 'PPp')}
                  </div>
                  
                  {meeting.duration_minutes && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(meeting.duration_minutes)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewSummary(meeting.id)}
                  className="flex items-center gap-1"
                >
                  <Eye className="h-3 w-3" />
                  View Summary
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{meeting.title}"? This action cannot be undone.
                        This will permanently delete the meeting, transcript, and summary.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => onDelete(meeting.id)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-3">
              {/* 40-word overview */}
              <p className="text-sm text-muted-foreground line-clamp-3">
                {generateOverview(meeting)}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  
                  {meeting.transcript_count ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageSquare className="h-3 w-3" />
                      {meeting.transcript_count} transcript entries
                    </div>
                  ) : null}
                  
                  {meeting.summary_exists && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      Summary available
                    </div>
                  )}
                </div>
                
                <div className="text-xs text-muted-foreground">
                  Created {format(new Date(meeting.created_at), 'PP')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};